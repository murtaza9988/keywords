"use client";
import Layout from './components/Layout';
import ProjectDetail from './components/ProjectDetail';
import { Provider } from 'react-redux';
import { store } from '@/store/store'
export default function ProjectDetailPage() {
  return (
    <Provider store={store}>
    <Layout>
      <ProjectDetail />
    </Layout>
    </Provider>
  );
}