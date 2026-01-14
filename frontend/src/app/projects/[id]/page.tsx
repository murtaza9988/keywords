"use client";
import dynamic from 'next/dynamic';
import Layout from './components/Layout';
import { Provider } from 'react-redux';
import { store } from '@/store/store';

const ProjectDetail = dynamic(() => import('./components/ProjectDetail'), {
  ssr: false,
});
export default function ProjectDetailPage() {
  return (
    <Provider store={store}>
      <Layout>
        <ProjectDetail />
      </Layout>
    </Provider>
  );
}
