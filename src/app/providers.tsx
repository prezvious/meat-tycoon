'use client';

import '@ant-design/v5-patch-for-react-19';
import { App, ConfigProvider } from 'antd';
import { interfaceTheme } from '@/lib/design-system';

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ConfigProvider theme={interfaceTheme}>
      <App>{children}</App>
    </ConfigProvider>
  );
}
