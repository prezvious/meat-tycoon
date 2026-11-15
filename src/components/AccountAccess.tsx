'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { App, Button, Card, Form, Input, Typography } from 'antd';
import { sendMagicLink, setAccountPassword, signInWithGoogle } from '@/app/actions';
import { PanelTitle } from './AppShell';

type AccountUser = { isAnonymous: boolean; email: string | null; emailVerified: boolean };

export function AccountAccess({ user }: { user: AccountUser }) {
  const [pending, startTransition] = useTransition();
  const { message } = App.useApp();
  const router = useRouter();

  function submit(action: () => Promise<{ ok: boolean; message?: string }>) {
    startTransition(async () => {
      try {
        const result = await action();
        if (!result.ok) { message.error(result.message ?? 'Account update failed.'); return; }
        message.success(result.message ?? 'Account updated.');
        router.refresh();
      } catch {
        message.error('The account service is unavailable. Please retry.');
      }
    });
  }

  return (
    <Card className="account-access" title={<PanelTitle icon="lucide:shield-check">{user.isAnonymous ? 'Keep this guest save' : 'Account access'}</PanelTitle>}>
      {user.isAnonymous ? (
        <div className="account-stack">
          <Typography.Text className="account-description">Attach a new email or Google identity to this save. Existing accounts cannot be merged. Keep this session open until verification completes.</Typography.Text>
          <Form className="account-form" layout="vertical" onFinish={(values: { email: string }) => submit(() => sendMagicLink(values.email))}>
            <Form.Item name="email" label="Email" rules={[{ required: true }, { type: 'email' }]}>
              <Input inputMode="email" autoComplete="email" />
            </Form.Item>
            <Button className="action-button" htmlType="submit" loading={pending}>Verify email</Button>
          </Form>
          <form action={signInWithGoogle}><Button htmlType="submit">Attach Google account</Button></form>
        </div>
      ) : (
        <Typography.Text className="account-email">{user.email}</Typography.Text>
      )}
      {user.emailVerified && (
        <Form className="account-form account-password" layout="vertical" onFinish={(values: { password: string }) => submit(() => setAccountPassword(values.password))}>
          <Form.Item name="password" label="Password" rules={[{ required: true, min: 6 }]}>
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Button className="action-button" htmlType="submit" loading={pending}>Set password</Button>
        </Form>
      )}
    </Card>
  );
}
