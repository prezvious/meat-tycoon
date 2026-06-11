'use client';

import '@ant-design/v5-patch-for-react-19';
import { App, ConfigProvider, theme } from 'antd';

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: '#306b56',
          colorInfo: '#245f78',
          colorSuccess: '#2f7d4f',
          colorWarning: '#9a6518',
          colorError: '#a64040',
          colorBgLayout: '#f6f4ef',
          colorBgContainer: '#fffdf8',
          borderRadius: 6,
          fontFamily:
            'Aptos, "Segoe UI Variable", "Segoe UI", ui-sans-serif, system-ui, sans-serif',
          fontSize: 14
        },
        components: {
          Layout: {
            bodyBg: '#f6f4ef',
            headerBg: '#fffdf8',
            siderBg: '#fffdf8'
          },
          Card: {
            borderRadiusLG: 6
          },
          Button: {
            borderRadius: 6
          }
        }
      }}
    >
      <App>{children}</App>
    </ConfigProvider>
  );
}
