"use client";

import React, { useMemo, useState } from 'react';

const DEFAULT_ALLOWED_EMAILS: string[] = [];

export default function GatekeeperPage() {
  const [allowedEmails, setAllowedEmails] = useState<string[]>(DEFAULT_ALLOWED_EMAILS);
  const [pendingEmail, setPendingEmail] = useState<string>('');

  const normalizedEmails = useMemo(
    () => allowedEmails.map((email: string) => email.trim().toLowerCase()).filter(Boolean),
    [allowedEmails],
  );

  const handleAddEmail = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextEmail = pendingEmail.trim().toLowerCase();
    if (!nextEmail) {
      return;
    }

    setAllowedEmails(prev => (prev.includes(nextEmail) ? prev : [...prev, nextEmail]));
    setPendingEmail('');
  };

  const handleRemoveEmail = (email: string) => {
    setAllowedEmails(prev => prev.filter((currentEmail: string) => currentEmail !== email));
  };

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-2xl font-semibold">Gatekeeper</h1>
        <p className="text-sm text-muted">Manage the email allowlist for access.</p>
      </header>

      <form onSubmit={handleAddEmail} className="flex flex-col gap-2">
        <label className="text-sm font-medium" htmlFor="gatekeeper-email">
          Add email
        </label>
        <div className="flex gap-2">
          <input
            id="gatekeeper-email"
            type="email"
            className="flex-1 rounded-md border border-border bg-surface px-3 py-2 text-sm"
            value={pendingEmail}
            onChange={event => setPendingEmail(event.target.value)}
            placeholder="name@example.com"
          />
          <button
            type="submit"
            className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white"
          >
            Add
          </button>
        </div>
      </form>

      <div className="rounded-md border border-border p-4">
        <h2 className="text-sm font-semibold">Allowed emails</h2>
        {normalizedEmails.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No email addresses have been added yet.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {normalizedEmails.map((email: string) => (
              <li key={email} className="flex items-center justify-between">
                <span>{email}</span>
                <button
                  type="button"
                  className="text-xs font-medium text-red-400 hover:text-red-300"
                  onClick={() => handleRemoveEmail(email)}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
