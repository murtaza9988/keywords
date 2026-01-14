import argparse
import asyncio
import json
from typing import Dict, Iterable, List, Set

from sqlalchemy import text as sql_text

from app.database import get_db_context
from app.routes.keyword_processing import process_keyword
from app.services.merge_token import TokenMergeService


def parse_tokens(raw_tokens: object) -> List[str]:
    if raw_tokens is None:
        return []
    if isinstance(raw_tokens, list):
        return raw_tokens
    if isinstance(raw_tokens, str):
        try:
            parsed = json.loads(raw_tokens)
            return parsed if isinstance(parsed, list) else []
        except json.JSONDecodeError:
            return []
    return []


def normalize_tokens(tokens: Iterable[str]) -> List[str]:
    normalized = []
    for token in tokens:
        token_str = str(token).lower().strip()
        if token_str:
            normalized.append(token_str)
    return sorted(set(normalized))


def apply_merge_map(tokens: List[str], merge_map: Dict[str, str]) -> List[str]:
    if not merge_map:
        return tokens
    merged_tokens = [merge_map.get(token, token) for token in tokens]
    return normalize_tokens(merged_tokens)


async def load_merge_map(db, project_id: int) -> Dict[str, str]:
    query = sql_text(
        """
        SELECT parent_token, child_tokens
        FROM merge_operations
        WHERE project_id = :project_id
        """
    )
    result = await db.execute(query, {"project_id": project_id})
    merge_map: Dict[str, str] = {}
    for parent_token, child_tokens in result.fetchall():
        if not child_tokens:
            continue
        if isinstance(child_tokens, list):
            child_list = child_tokens
        else:
            child_list = json.loads(child_tokens) if isinstance(child_tokens, str) else []
        for child in child_list:
            child_normalized = str(child).lower().strip()
            if child_normalized:
                merge_map[child_normalized] = str(parent_token).lower().strip()
    return merge_map


async def backfill_project(project_id: int, batch_size: int, dry_run: bool) -> None:
    affected_tokens: Set[str] = set()
    updated_count = 0
    skipped_count = 0
    last_id = 0

    async with get_db_context() as db:
        merge_map = await load_merge_map(db, project_id)

        while True:
            query = sql_text(
                """
                SELECT id, keyword, tokens
                FROM keywords
                WHERE project_id = :project_id
                AND id > :last_id
                ORDER BY id
                LIMIT :limit
                """
            )
            result = await db.execute(
                query,
                {"project_id": project_id, "last_id": last_id, "limit": batch_size},
            )
            rows = result.fetchall()
            if not rows:
                break

            for row in rows:
                last_id = row.id
                processed, ok = process_keyword({"Keyword": row.keyword})
                if not ok or not processed:
                    skipped_count += 1
                    continue

                new_tokens = normalize_tokens(processed.get("tokens", []))
                new_tokens = apply_merge_map(new_tokens, merge_map)
                existing_tokens = normalize_tokens(parse_tokens(row.tokens))

                if new_tokens == existing_tokens:
                    continue

                affected_tokens.update(existing_tokens)
                affected_tokens.update(new_tokens)

                if not dry_run:
                    await db.execute(
                        sql_text(
                            """
                            UPDATE keywords
                            SET tokens = :tokens
                            WHERE id = :keyword_id
                            """
                        ),
                        {"tokens": json.dumps(new_tokens), "keyword_id": row.id},
                    )
                updated_count += 1

            if not dry_run:
                await db.commit()

        if not dry_run and affected_tokens:
            affected_list = sorted(affected_tokens)
            grouped_count = await TokenMergeService._restructure_affected_keywords(
                db, project_id, affected_list
            )
            ungrouped_count = await TokenMergeService._handle_ungrouped_matching_grouped_parents(
                db, project_id, affected_list
            )
            await db.commit()
            print(
                "Grouping updates applied: "
                f"{grouped_count} groups restructured, "
                f"{ungrouped_count} ungrouped keywords matched to grouped parents."
            )

    print(
        "Backfill complete: "
        f"{updated_count} keywords updated, {skipped_count} skipped."
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Backfill keyword tokens using the compound normalization pipeline."
    )
    parser.add_argument("--project-id", type=int, required=True, help="Project ID to backfill")
    parser.add_argument(
        "--batch-size", type=int, default=500, help="Number of rows to process per batch"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Process keywords without writing changes to the database",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    asyncio.run(backfill_project(args.project_id, args.batch_size, args.dry_run))


if __name__ == "__main__":
    main()
