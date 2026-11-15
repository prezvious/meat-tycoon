'use client';

import { Icon } from '@iconify-icon/react';
import { Layout } from 'antd';
import { interfaceDimensions } from '@/lib/design-system';

const { Header, Content } = Layout;

export function InterfaceIcon({ icon, large = false }: { icon: string; large?: boolean }) {
  const size = large ? interfaceDimensions.iconLarge : interfaceDimensions.icon;
  return <span className="interface-icon" aria-hidden="true"><Icon icon={icon} width={size} height={size} /></span>;
}

export function PanelTitle({ children, icon }: { children: React.ReactNode; icon: string }) {
  return <h2 className="panel-title"><InterfaceIcon icon={icon} /><span>{children}</span></h2>;
}

export function Shell({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <Layout className="app-shell">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <Header className="app-header">
        <div className="header-inner">
          <div className="brand-block">
            <div className="brand-mark" aria-hidden="true">
              <InterfaceIcon icon="lucide:chart-no-axes-combined" large />
            </div>
            <div>
              <h1 className="brand-title">Meat Tycoon</h1>
              <p className="brand-subtitle">Real-time cooking economy dashboard</p>
            </div>
          </div>
          {right && <div className="header-actions">{right}</div>}
        </div>
      </Header>
      <Content id="main-content" tabIndex={-1} className="content-wrap">{children}</Content>
    </Layout>
  );
}
