'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@iconify-icon/react';
import {
  Alert,
  App,
  Button,
  Card,
  Flex,
  Form,
  Input,
  Layout,
  Select,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
  Typography
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { GameModel, SignedInModel } from '@/lib/game/model';
import { formatWeightKg } from '@/lib/game/formulas.mjs';
import {
  applySeasoning,
  buyShopLuck,
  buyShopRefreshSpeed,
  buyEquipment,
  buyMeat,
  buySeasoning,
  claimSaleModifier,
  destroyEquipment,
  manualRefreshShop,
  resolveTimeProgress,
  sellAllMeat,
  sellMeat,
  sellSeasoning,
  signInWithGoogle,
  signInWithPassword,
  signOut,
  signUpWithPassword,
  startCooking,
  startGuestSession
} from '@/app/actions';

const { Header, Content } = Layout;
const { Text, Title } = Typography;

type AuthMode = 'signin' | 'signup';
type Row = Record<string, unknown>;
const SALEABLE_COOKED_STATES = new Set(['cooked', 'well_cooked', 'perfectly_cooked']);

function relation(row: Row, key: string): Row | undefined {
  const value = row[key];
  return value && typeof value === 'object' ? (value as Row) : undefined;
}

function textValue(value: unknown, fallback = '') {
  if (value === null || value === undefined) return fallback;
  return String(value);
}

function money(value: unknown) {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: Math.abs(amount) >= 1000000 ? 'compact' : 'standard',
    maximumFractionDigits: 2
  }).format(amount);
}

function numberValue(value: unknown, digits = 2) {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return '0';
  return amount.toLocaleString('en-US', {
    maximumFractionDigits: digits
  });
}

function formatState(value: unknown) {
  return String(value ?? 'raw')
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function isSaleableCookedState(value: unknown) {
  return SALEABLE_COOKED_STATES.has(textValue(value));
}

function rarityColor(value: unknown) {
  switch (textValue(value)) {
    case 'impossible':
    case 'absurd':
    case 'giant':
    case 'huge':
      return 'gold';
    case 'massive':
    case 'heavy':
      return 'volcano';
    case 'large':
      return 'blue';
    default:
      return undefined;
  }
}

function dateTime(value: unknown) {
  if (!value) return '-';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
}

function Shell({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <Layout className="app-shell">
      <Header className="app-header">
        <div className="brand-block">
          <div className="brand-mark" aria-hidden="true">
            <Icon icon="lucide:chart-no-axes-combined" width="22" height="22" />
          </div>
          <div>
            <h1 className="brand-title">Meat Tycoon</h1>
            <p className="brand-subtitle">Real-time cooking economy dashboard</p>
          </div>
        </div>
        {right}
      </Header>
      <Content className="content-wrap">{children}</Content>
    </Layout>
  );
}

export function GameDashboard({ model }: { model: GameModel }) {
  if (model.status === 'setup_required') {
    return <SetupRequired model={model} />;
  }

  if (model.status === 'signed_out') {
    return <SignedOut />;
  }

  return <ReadyDashboard model={model} />;
}

function SetupRequired({ model }: { model: Extract<GameModel, { status: 'setup_required' }> }) {
  return (
    <Shell>
      <Card className="setup-panel" title="Supabase setup required">
        <Space direction="vertical" size="large">
          <Alert
            type="warning"
            showIcon
            message="The interface is installed, but Supabase credentials are not configured."
            description="Add the environment variables, apply the migration, and seed the catalog before playing."
          />
          <div className="stat-grid">
            <Card>
              <Statistic title="Meats parsed" value={model.catalogCounts.meats} />
            </Card>
            <Card>
              <Statistic title="Equipment parsed" value={model.catalogCounts.equipment} />
            </Card>
            <Card>
              <Statistic title="Seasonings parsed" value={model.catalogCounts.seasonings} />
            </Card>
            <Card>
              <Statistic title="Weight profiles" value={model.catalogCounts.weightProfiles} />
            </Card>
          </div>
          <Text type="secondary">
            Run the Supabase migration and `npm run seed:catalog` after setting environment variables.
          </Text>
        </Space>
      </Card>
    </Shell>
  );
}

function SignedOut() {
  const router = useRouter();
  const { message } = App.useApp();
  const [pending, startTransition] = useTransition();
  const [authMode, setAuthMode] = useState<AuthMode>('signin');

  async function run(resultPromise: Promise<{ ok: boolean; message?: string }>) {
    const result = await resultPromise;
    if (!result.ok) {
      message.error(result.message ?? 'The account action failed.');
      return;
    }
    if (result.message) message.success(result.message);
    router.refresh();
  }

  return (
    <Shell>
      <div className="auth-grid">
        <section className="auth-intro">
          <Title level={1}>Meat Tycoon</Title>
          <p>
            Buy fixed-price meat, roll weight, cook in real time, apply durable seasonings,
            and sell through a server-authoritative economy. Guest saves can be linked to an
            account when you are ready.
          </p>
        </section>

        <Card className="auth-card" title="Start or sign in">
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Button
              block
              type="primary"
              loading={pending}
              icon={<Icon icon="lucide:user-round-plus" width="16" height="16" />}
              onClick={() => startTransition(() => run(startGuestSession()))}
            >
              Continue as guest
            </Button>

            <Tabs
              activeKey={authMode}
              onChange={(key) => setAuthMode(key as AuthMode)}
              onTabClick={(key) => setAuthMode(key as AuthMode)}
              items={[
                { key: 'signin', label: 'Sign In', children: null },
                { key: 'signup', label: 'Sign Up', children: null }
              ]}
            />

            <AccountForm
              mode={authMode}
              pending={pending}
              onSubmit={(values) =>
                startTransition(() => {
                  if (authMode === 'signup') {
                    return run(signUpWithPassword(values.email, values.password ?? ''));
                  }
                  return run(signInWithPassword(values.email, values.password ?? ''));
                })
              }
            />

            <form action={signInWithGoogle}>
              <Button
                block
                htmlType="submit"
                icon={<Icon icon="logos:google-icon" width="16" height="16" />}
              >
                Continue with Google
              </Button>
            </form>
          </Space>
        </Card>
      </div>
    </Shell>
  );
}

function AccountForm({
  mode,
  pending,
  onSubmit
}: {
  mode: AuthMode;
  pending: boolean;
  onSubmit: (values: { email: string; password?: string }) => void;
}) {
  return (
    <Form layout="vertical" onFinish={onSubmit} requiredMark={false}>
      <Form.Item
        label="Email"
        name="email"
        rules={[
          { required: true, message: 'Enter an email address.' },
          { type: 'email', message: 'Enter a valid email address.' }
        ]}
      >
        <Input autoComplete="email" />
      </Form.Item>
      <Form.Item
        label="Password"
        name="password"
        rules={[{ required: true, message: 'Enter a password.' }]}
      >
        <Input.Password autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} />
      </Form.Item>
      <Button
        block
        type="primary"
        htmlType="submit"
        loading={pending}
        icon={<Icon icon="lucide:log-in" width="16" height="16" />}
      >
        {mode === 'signup' ? 'Sign Up' : 'Sign In'}
      </Button>
    </Form>
  );
}

function ReadyDashboard({ model }: { model: SignedInModel }) {
  const router = useRouter();
  const { message } = App.useApp();
  const [pending, startTransition] = useTransition();
  const [equipmentByMeat, setEquipmentByMeat] = useState<Record<string, string>>({});
  const [targetByMeat, setTargetByMeat] = useState<Record<string, string>>({});

  const meatById = useMemo(
    () => new Map(model.meats.map((item) => [String(item.id), item])),
    [model.meats]
  );
  const seasoningById = useMemo(
    () => new Map(model.seasonings.map((item) => [String(item.id), item])),
    [model.seasonings]
  );
  const shopStateByType = useMemo(
    () => new Map(model.shopStates.map((item) => [String(item.shop_type), item])),
    [model.shopStates]
  );
  const activeModifierIds = useMemo(
    () => new Set(model.activeSaleModifiers.map((item) => String(item.definition_id))),
    [model.activeSaleModifiers]
  );

  const activeEquipment = model.ownedEquipment
    .map((item) => item.equipment_items as Row | undefined)
    .filter((item): item is Row => Boolean(item));
  const firstEquipmentId = String(activeEquipment[0]?.id ?? '');
  const firstSeasoningId = String(model.ownedSeasonings[0]?.id ?? '');
  const equipmentOptions = activeEquipment.map((item) => ({
    value: String(item.id),
    label: textValue(item.display_name, String(item.id))
  }));
  const targetOptions = [
    { value: 'cooked', label: 'Cooked' },
    { value: 'well_cooked', label: 'Well Cooked' },
    { value: 'perfectly_cooked', label: 'Perfectly Cooked' }
  ];
  const rawMeats = model.ownedMeats.filter((item) => textValue(item.current_cooking_state) === 'raw');
  const readyMeats = model.ownedMeats.filter((item) => isSaleableCookedState(item.current_cooking_state));
  const heldMeats = model.ownedMeats.filter((item) => {
    const state = textValue(item.current_cooking_state);
    return state !== 'raw' && !SALEABLE_COOKED_STATES.has(state);
  });

  function run(resultPromise: Promise<{ ok: boolean; message?: string }>, success = 'Updated') {
    startTransition(async () => {
      const result = await resultPromise;
      if (!result.ok) {
        message.error(result.message ?? 'Action failed.');
        return;
      }
      message.success(success);
      router.refresh();
    });
  }

  function shopControls(shopType: 'meat' | 'seasoning') {
    const state = shopStateByType.get(shopType);
    const label = shopType === 'meat' ? 'Meat' : 'Seasoning';

    return (
      <div className="shop-controls">
        <Space wrap>
          <Tag>Stage {numberValue(state?.shop_stage, 0)}</Tag>
          <Tag>Luck {numberValue(state?.luck_level, 0)}</Tag>
          <Tag>Refresh {numberValue(state?.refresh_speed_level, 0)}</Tag>
          <Tag>Next {dateTime(state?.refresh_due_at)}</Tag>
        </Space>
        <Space wrap>
          <Button
            size="small"
            loading={pending}
            icon={<Icon icon="lucide:refresh-cw" width="15" height="15" />}
            onClick={() => run(manualRefreshShop(shopType), `${label} shop refreshed`)}
          >
            Refresh
          </Button>
          <Button
            size="small"
            loading={pending}
            icon={<Icon icon="lucide:timer" width="15" height="15" />}
            onClick={() => run(buyShopRefreshSpeed(shopType), 'Refresh speed upgraded')}
          >
            Speed
          </Button>
          <Button
            size="small"
            loading={pending}
            icon={<Icon icon="lucide:sparkles" width="15" height="15" />}
            onClick={() => run(buyShopLuck(shopType), 'Luck upgraded')}
          >
            Luck
          </Button>
        </Space>
      </div>
    );
  }

  const meatColumns: ColumnsType<Row> = [
    {
      title: 'Meat',
      dataIndex: 'display_name',
      render: (_, row) =>
        textValue(row.display_name ?? meatById.get(String(row.item_id))?.display_name, textValue(row.item_id))
    },
    {
      title: 'Price',
      dataIndex: 'purchase_price',
      render: money,
      align: 'right'
    },
    {
      title: 'Tier',
      dataIndex: 'rarity_class',
      render: (value) => <Tag>{String(value ?? 'Starter')}</Tag>
    },
    {
      title: '',
      render: (_, row) => (
        <div className="table-actions">
          <Button
            size="small"
            type="primary"
            loading={pending}
            onClick={() => run(buyMeat(String(row.id ?? row.item_id)), 'Meat bought')}
          >
            Buy
          </Button>
        </div>
      )
    }
  ];

  const equipmentColumns: ColumnsType<Row> = [
    { title: 'Equipment', dataIndex: 'display_name' },
    { title: 'Type', dataIndex: 'equipment_type' },
    { title: 'Slots', dataIndex: 'cooking_slot_count', align: 'right' },
    {
      title: 'Multiplier',
      dataIndex: 'price_multiplier',
      align: 'right',
      render: (value) => `${numberValue(value)}x`
    },
    {
      title: 'Price',
      dataIndex: 'purchase_price',
      render: money,
      align: 'right'
    },
    {
      title: '',
      render: (_, row) => (
        <div className="table-actions">
          <Button
            size="small"
            loading={pending}
            onClick={() => run(buyEquipment(String(row.id)), 'Equipment bought')}
          >
            Buy
          </Button>
        </div>
      )
    }
  ];

  const seasoningColumns: ColumnsType<Row> = [
    {
      title: 'Seasoning',
      dataIndex: 'display_name',
      render: (_, row) =>
        textValue(
          row.display_name ?? seasoningById.get(String(row.item_id))?.display_name,
          textValue(row.item_id)
        )
    },
    {
      title: 'Uses',
      dataIndex: 'maximum_uses',
      align: 'right',
      render: (_, row) => Number(row.maximum_uses ?? seasoningById.get(String(row.item_id))?.maximum_uses ?? 0)
    },
    {
      title: 'Multiplier',
      dataIndex: 'base_multiplier',
      align: 'right',
      render: (_, row) =>
        `${numberValue(row.base_multiplier ?? seasoningById.get(String(row.item_id))?.base_multiplier)}x`
    },
    {
      title: 'Price',
      dataIndex: 'purchase_price',
      render: money,
      align: 'right'
    },
    {
      title: '',
      render: (_, row) => (
        <div className="table-actions">
          <Button
            size="small"
            loading={pending}
            onClick={() => run(buySeasoning(String(row.id ?? row.item_id)), 'Seasoning bought')}
          >
            Buy
          </Button>
        </div>
      )
    }
  ];

  const ownedMeatColumns: ColumnsType<Row> = [
    {
      title: 'Meat',
      render: (_, row) => textValue(relation(row, 'meat_items')?.display_name, textValue(row.meat_item_id))
    },
    {
      title: 'Weight',
      dataIndex: 'spawned_weight',
      align: 'right',
      render: formatWeightKg
    },
    {
      title: 'State',
      dataIndex: 'current_cooking_state',
      render: (value) => <Tag>{formatState(value)}</Tag>
    },
    {
      title: 'Spoils',
      dataIndex: 'spoilage_due_at',
      render: dateTime
    },
    {
      title: 'Roll',
      dataIndex: 'weight_rarity_result',
      render: (value) => <Tag color={rarityColor(value)}>{formatState(value)}</Tag>
    },
    {
      title: '',
      render: (_, row) => {
        const rowId = String(row.id);
        const selectedEquipment = equipmentByMeat[rowId] ?? firstEquipmentId;
        const selectedTarget = targetByMeat[rowId] ?? 'perfectly_cooked';
        const state = textValue(row.current_cooking_state);
        const canCook = state === 'raw';
        const canSell = SALEABLE_COOKED_STATES.has(state);

        return (
          <Flex className={canCook ? 'table-actions table-actions-wide' : 'table-actions'} gap={8} justify="end" wrap>
            {canCook && (
              <>
                <Select
                  size="small"
                  aria-label="Cooking equipment"
                  value={selectedEquipment || undefined}
                  placeholder="Equipment"
                  options={equipmentOptions}
                  onChange={(value) => setEquipmentByMeat((current) => ({ ...current, [rowId]: value }))}
                  style={{ width: 170 }}
                />
                <Select
                  size="small"
                  aria-label="Cooking target"
                  value={selectedTarget}
                  options={targetOptions}
                  onChange={(value) => setTargetByMeat((current) => ({ ...current, [rowId]: value }))}
                  style={{ width: 150 }}
                />
                <Button
                  size="small"
                  disabled={!selectedEquipment}
                  loading={pending}
                  onClick={() => run(startCooking(rowId, selectedEquipment, selectedTarget), 'Cooking started')}
                >
                  Cook
                </Button>
              </>
            )}
            {canSell && (
              <>
                <Button
                  size="small"
                  disabled={!firstSeasoningId}
                  loading={pending}
                  onClick={() => run(applySeasoning(rowId, firstSeasoningId), 'Seasoning applied')}
                >
                  Season
                </Button>
                <Button
                  size="small"
                  type="primary"
                  loading={pending}
                  onClick={() => run(sellMeat(rowId), 'Meat sold')}
                >
                  Sell
                </Button>
              </>
            )}
            {!canCook && !canSell && <Tag>Not ready</Tag>}
          </Flex>
        );
      }
    }
  ];

  return (
    <Shell
      right={
        <Space wrap>
          <Button
            loading={pending}
            icon={<Icon icon="lucide:refresh-cw" width="16" height="16" />}
            onClick={() => run(resolveTimeProgress(), 'Time progress resolved')}
          >
            Sync time
          </Button>
          <form action={signOut}>
            <Button htmlType="submit" icon={<Icon icon="lucide:log-out" width="16" height="16" />}>
              Sign out
            </Button>
          </form>
        </Space>
      }
    >
      <div className="stat-grid">
        <Card>
          <Statistic title="Balance" value={money(model.save?.balance)} />
        </Card>
        <Card>
          <Statistic title="Unsold meat" value={model.ownedMeats.length} />
        </Card>
        <Card>
          <Statistic title="Active cooking jobs" value={model.cookingJobs.length} />
        </Card>
        <Card>
          <Statistic title="Best sale" value={money(model.stats?.best_sale_value)} />
        </Card>
      </div>

      {model.user.isAnonymous && (
        <Alert
          style={{ marginBottom: 16 }}
          type="info"
          showIcon
          message="Guest save active"
          description="Create or sign in to an account to keep this save across devices. Existing accounts are not merged or overwritten."
        />
      )}

      {model.saleModifierDefinitions.length > 0 && (
        <div className="modifier-strip">
          <Space wrap>
            <Text strong>Sale modifiers</Text>
            {model.saleModifierDefinitions.map((modifier) => {
              const modifierId = String(modifier.id);
              const isActive = activeModifierIds.has(modifierId);

              return (
                <Button
                  key={modifierId}
                  size="small"
                  disabled={isActive}
                  loading={pending}
                  icon={<Icon icon={isActive ? 'lucide:badge-check' : 'lucide:badge-plus'} width="15" height="15" />}
                  onClick={() => run(claimSaleModifier(modifierId), 'Sale modifier claimed')}
                >
                  {textValue(modifier.display_name, modifierId)} {numberValue(Number(modifier.multiplier) * 100, 0)}%
                </Button>
              );
            })}
          </Space>
        </div>
      )}

      <Tabs
        items={[
          {
            key: 'kitchen',
            label: 'Kitchen',
            children: (
              <Flex className="kitchen-workspace" gap={16} align="start">
                <Flex className="meat-flow" vertical gap={16}>
                  <Card title="Raw meat" extra={<Tag>Cook before sale</Tag>}>
                    <Table
                      rowKey="id"
                      size="small"
                      columns={ownedMeatColumns}
                      dataSource={rawMeats}
                      pagination={{ pageSize: 6 }}
                      scroll={{ x: 760 }}
                    />
                  </Card>
                  {heldMeats.length > 0 && (
                    <Card title="Needs attention">
                      <Table
                        rowKey="id"
                        size="small"
                        columns={ownedMeatColumns}
                        dataSource={heldMeats}
                        pagination={{ pageSize: 4 }}
                        scroll={{ x: 760 }}
                      />
                    </Card>
                  )}
                </Flex>
                <Flex className="meat-flow" vertical gap={16}>
                  <Card title="Active cooking">
                    {model.cookingJobs.length ? (
                      <Table<Row>
                        rowKey="id"
                        size="small"
                        dataSource={model.cookingJobs}
                        pagination={false}
                        columns={[
                          {
                            title: 'Meat',
                            render: (_, row) =>
                              textValue(
                                relation(relation(row, 'meat_instances') ?? {}, 'meat_items')?.display_name,
                                textValue(row.meat_instance_id)
                              )
                          },
                          {
                            title: 'Target',
                            dataIndex: 'target_cooking_state',
                            render: formatState
                          },
                          {
                            title: 'Finishes',
                            dataIndex: 'cooking_target_end_at',
                            render: (value) => new Date(String(value)).toLocaleString()
                          }
                        ]}
                      />
                    ) : (
                      <p className="empty-detail">No meat is cooking.</p>
                    )}
                  </Card>
                  <Card
                    title="Ready to sell"
                    extra={
                      <Button
                        size="small"
                        type="primary"
                        loading={pending}
                        disabled={readyMeats.length === 0}
                        icon={<Icon icon="lucide:badge-dollar-sign" width="15" height="15" />}
                        onClick={() => run(sellAllMeat(), 'Cooked meat sold')}
                      >
                        Sell all
                      </Button>
                    }
                  >
                    <Table
                      rowKey="id"
                      size="small"
                      columns={ownedMeatColumns}
                      dataSource={readyMeats}
                      pagination={{ pageSize: 6 }}
                      scroll={{ x: 760 }}
                    />
                  </Card>
                </Flex>
              </Flex>
            )
          },
          {
            key: 'meat-shop',
            label: 'Meat Shop',
            children: (
              <>
                {shopControls('meat')}
                <Card title="Available meat">
                  <Table
                    rowKey={(row) => String(row.id ?? row.item_id)}
                    size="small"
                    columns={meatColumns}
                    dataSource={[
                      ...model.meats.filter((item) => item.starter_only),
                      ...model.meatStock
                    ]}
                    pagination={{ pageSize: 12 }}
                    scroll={{ x: 760 }}
                  />
                </Card>
              </>
            )
          },
          {
            key: 'seasoning-shop',
            label: 'Seasoning Shop',
            children: (
              <>
                {shopControls('seasoning')}
                <Card title="Available seasonings">
                  <Table
                    rowKey={(row) => String(row.id ?? row.item_id)}
                    size="small"
                    columns={seasoningColumns}
                    dataSource={model.seasoningStock}
                    pagination={{ pageSize: 10 }}
                    scroll={{ x: 760 }}
                  />
                </Card>
              </>
            )
          },
          {
            key: 'equipment-shop',
            label: 'Equipment Shop',
            children: (
              <Card title="Equipment catalog">
                <Table
                  rowKey="id"
                  size="small"
                  columns={equipmentColumns}
                  dataSource={model.equipment}
                  pagination={{ pageSize: 12 }}
                  scroll={{ x: 860 }}
                />
              </Card>
            )
          },
          {
            key: 'inventory',
            label: 'Inventory',
            children: (
              <div className="panel-grid">
                <Card title="Owned equipment">
                  <Table<Row>
                    rowKey={(row) => String(row.equipment_item_id)}
                    size="small"
                    dataSource={model.ownedEquipment}
                    pagination={false}
                    columns={[
                      {
                        title: 'Equipment',
                        render: (_, row) =>
                          textValue(relation(row, 'equipment_items')?.display_name, textValue(row.equipment_item_id))
                      },
                      {
                        title: 'Slots',
                        render: (_, row) => Number(relation(row, 'equipment_items')?.cooking_slot_count ?? 1),
                        align: 'right'
                      },
                      {
                        title: 'Multiplier',
                        render: (_, row) => `${numberValue(relation(row, 'equipment_items')?.price_multiplier)}x`,
                        align: 'right'
                      },
                      {
                        title: '',
                        render: (_, row) => (
                          <div className="table-actions">
                            <Button
                              size="small"
                              danger
                              loading={pending}
                              onClick={() => run(destroyEquipment(String(row.equipment_item_id)), 'Equipment destroyed')}
                            >
                              Destroy
                            </Button>
                          </div>
                        )
                      }
                    ]}
                  />
                </Card>
                <Card title="Owned seasonings">
                  <Table<Row>
                    rowKey="id"
                    size="small"
                    dataSource={model.ownedSeasonings}
                    pagination={{ pageSize: 8 }}
                    columns={[
                      {
                        title: 'Seasoning',
                        render: (_, row) =>
                          textValue(relation(row, 'seasoning_items')?.display_name, textValue(row.seasoning_item_id))
                      },
                      {
                        title: 'Uses',
                        render: (_, row) => `${row.remaining_uses}/${row.maximum_uses}`,
                        align: 'right'
                      },
                      {
                        title: 'Expires',
                        render: () => 'No',
                        align: 'right'
                      },
                      {
                        title: '',
                        render: (_, row) => (
                          <div className="table-actions">
                            <Button
                              size="small"
                              loading={pending}
                              onClick={() => run(sellSeasoning(String(row.id)), 'Seasoning sold')}
                            >
                              Sell back
                            </Button>
                          </div>
                        )
                      }
                    ]}
                  />
                </Card>
              </div>
            )
          }
        ]}
      />
    </Shell>
  );
}
