'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Alert,
  App,
  Button,
  Card,
  Flex,
  Form,
  Input,
  Progress,
  Select,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
  Typography
} from 'antd';
import { isSaleModifierActive } from '@/lib/game/time.mjs';
import { AccountAccess } from './AccountAccess';
import { formatCurrency } from '@/lib/game/currency.mjs';
import { interfaceDimensions } from '@/lib/design-system';
import { InterfaceIcon, PanelTitle, Shell } from './AppShell';
import type { ColumnsType } from 'antd/es/table';
import type { GameModel, SignedInModel } from '@/lib/game/model';
import {
  formatWeightKg,
  selectBestCookingEquipment
} from '@/lib/game/formulas.mjs';
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
  seasonAllMeat,
  sellAllMeat,
  sellMeat,
  sellSeasoning,
  signInWithPassword,
  signOut,
  signUpWithPassword,
  startCooking,
  startGuestSession
} from '@/app/actions';

const { Text, Title } = Typography;

type AuthMode = 'signin' | 'signup';
type Row = Record<string, unknown>;
type EquipmentCandidate = {
  equipment: Row;
  ownedEquipment: Row;
  totalSlots: number;
  occupiedSlots: number;
  freeSlots: number;
};
type CookingEstimate = {
  defaultCookingSeconds: number;
  preEquipmentSeconds: number;
  durationSeconds: number;
  equipmentSpeedMultiplier: number;
  longCookMultiplier: number;
};
type BestCookingEquipmentSelection = {
  equipment: Row;
  freeSlots: number;
  cookingEstimate: CookingEstimate;
  saleEstimate: { finalSellingPrice: string };
  equipmentMultiplier: number;
  compatibilityMultiplier: number;
};
const SALEABLE_COOKED_STATES = new Set(['cooked', 'well_cooked', 'perfectly_cooked']);

function relation(row: Row, key: string): Row | undefined {
  const value = row[key];
  return value && typeof value === 'object' ? (value as Row) : undefined;
}

function arrayValue(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

function textValue(value: unknown, fallback = '') {
  if (value === null || value === undefined) return fallback;
  return String(value);
}

function money(value: unknown) {
  return formatCurrency(String(value ?? '0'));
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

function formatMeatName(name: string): string {
  if (!name) return '';
  return name
    .replace(/[_-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((w) => {
      let prefix = '';
      let suffix = '';
      let word = w;
      if (word.startsWith('(')) {
        prefix = '(';
        word = word.slice(1);
      }
      if (word.endsWith(')')) {
        suffix = ')';
        word = word.slice(0, -1);
      }
      if (!word) return w;
      return prefix + word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() + suffix;
    })
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



function formatCountdown(targetDateStr: string | null | undefined) {
  if (!targetDateStr) return '-';
  const target = new Date(targetDateStr);
  if (Number.isNaN(target.getTime())) return '-';

  const now = Date.now();
  const diffMs = target.getTime() - now;

  if (diffMs <= 0) {
    return 'Ready';
  }

  const totalSecs = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSecs / 3600);
  const minutes = Math.floor((totalSecs % 3600) / 60);
  const seconds = totalSecs % 60;

  const day = String(target.getDate()).padStart(2, '0');
  const month = String(target.getMonth() + 1).padStart(2, '0');
  const year = target.getFullYear();

  return `${hours}h ${minutes}m ${seconds}s (${day},${month},${year})`;
}

function formatDurationSeconds(value: number) {
  const totalSecs = Math.max(0, Math.round(Number(value) || 0));
  const hours = Math.floor(totalSecs / 3600);
  const minutes = Math.floor((totalSecs % 3600) / 60);
  const seconds = totalSecs % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

function cookingDurationInputForRow(row: Row, meatItem: Row | undefined) {
  return {
    spawnedWeight: Number(row.spawned_weight ?? 1),
    defaultWeightKg: Number(meatItem?.default_weight_kg ?? 1),
    defaultCookedSeconds: Number(meatItem?.default_cooked_seconds ?? 30),
    defaultWellCookedSeconds: Number(meatItem?.default_well_cooked_seconds ?? 60),
    defaultPerfectlyCookedSeconds: Number(meatItem?.default_perfectly_cooked_seconds ?? 180),
    legendaryCookingEligible: meatItem?.legendary_cooking_eligible === true
  };
}

function saleInputForRow(row: Row, meatItem: Row | undefined) {
  return {
    spawnedWeight: Number(row.spawned_weight ?? 1),
    baseMeatValue: Number(row.base_meat_value_snapshot ?? meatItem?.base_meat_value ?? 0),
    categoryMultiplier: Number(meatItem?.category_multiplier ?? 1),
    purchasePricePaid: Number(row.purchase_price_paid ?? 0)
  };
}

function selectBestEquipmentForRow(
  row: Row,
  targetCookingState: string,
  equipmentCandidates: EquipmentCandidate[],
  meatItem: Row | undefined
): BestCookingEquipmentSelection | null {
  return selectBestCookingEquipment({
    equipmentCandidates,
    targetCookingState,
    meatEquipmentTags: arrayValue(meatItem?.equipment_compatibility_tags),
    durationInput: cookingDurationInputForRow(row, meatItem),
    saleInput: saleInputForRow(row, meatItem)
  }) as BestCookingEquipmentSelection | null;
}

export function GameDashboard({ model }: { model: GameModel }) {
  if (model.status === 'setup_required') {
    return <SetupRequired model={model} />;
  }

  if (model.status === 'load_error') return <LoadError message={model.message} />;

  if (model.status === 'signed_out') {
    return <SignedOut />;
  }

  return <ReadyDashboard model={model} />;
}

function LoadError({ message }: { message: string }) {
  const router = useRouter();
  return <Shell><div className="load-error-panel"><Alert type="error" showIcon message="Save unavailable" description={message} action={<Button onClick={() => router.refresh()}>Retry</Button>} /></div></Shell>;
}

function SetupRequired({ model }: { model: Extract<GameModel, { status: 'setup_required' }> }) {
  return (
    <Shell>
      <Card className="setup-panel" title={<PanelTitle icon="lucide:database">Supabase setup required</PanelTitle>}>
        <div className="setup-stack">
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
        </div>
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
    try {
      const result = await resultPromise;
      if (!result.ok) {
        message.error(result.message ?? 'The account action failed.');
        return;
      }
      if (result.message) message.success(result.message);
      router.refresh();
    } catch {
      message.error('The account service is unavailable. Please retry.');
    }
  }

  return (
    <Shell>
      <div className="auth-grid">
        <section className="auth-intro">
          <Title level={2}>Meat Tycoon</Title>
          <p>
            Buy fixed-price meat, roll weight, cook in real time, apply durable seasonings,
            and sell through a server-authoritative economy. Guest saves can be linked to an
            account when you are ready.
          </p>
        </section>

        <Card className="auth-card" title={<PanelTitle icon="lucide:key-round">Start or sign in</PanelTitle>}>
          <div className="auth-stack">
            <Button
              block
              type="primary"
              loading={pending}
              icon={<InterfaceIcon icon="lucide:user-round-plus" />}
              onClick={() => startTransition(() => run(startGuestSession()))}
            >
              Continue as guest
            </Button>

            <Tabs
              className="auth-tabs"
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

          </div>
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
    <Form className="auth-form" layout="vertical" onFinish={onSubmit} requiredMark={false}>
      <Form.Item
        label="Email"
        name="email"
        rules={[
          { required: true, message: 'Enter an email address.' },
          { type: 'email', message: 'Enter a valid email address.' }
        ]}
      >
        <Input inputMode="email" autoComplete="email" />
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
        icon={<InterfaceIcon icon="lucide:log-in" />}
      >
        {mode === 'signup' ? 'Sign Up' : 'Sign In'}
      </Button>
    </Form>
  );
}

type RunDashboardAction = (
  actionId: string,
  promise: Promise<{ ok: boolean; message?: string }>,
  successMessage: string,
  errorMessagePrefix: string
) => void;
type StartCookingActionArgs = {
  rowId: string;
  selectedTarget: string;
  bestEquipmentSelection: BestCookingEquipmentSelection | null;
  runAction: RunDashboardAction;
};

type RawMeatActionControlsProps = {
  rowId: string;
  bestEquipmentSelection: BestCookingEquipmentSelection | null;
  selectedTarget: string;
  targetOptions: { value: string; label: string }[];
  activeActionIds: Set<string>;
  setTargetByMeat: (updater: (current: Record<string, string>) => Record<string, string>) => void;
  runAction: RunDashboardAction;
};

function equipmentLabelForSelection(bestEquipmentSelection: BestCookingEquipmentSelection | null) {
  const equipment = bestEquipmentSelection?.equipment;
  return equipment ? textValue(equipment.display_name, String(equipment.id ?? '')) : 'No free equipment';
}

function runStartCookingAction({
  rowId,
  selectedTarget,
  bestEquipmentSelection,
  runAction
}: StartCookingActionArgs) {
  const selectedEquipmentItem = bestEquipmentSelection?.equipment;
  const cookingEstimate = bestEquipmentSelection?.cookingEstimate;
  if (!selectedEquipmentItem || !cookingEstimate) {
    return;
  }

  const selectedEquipment = String(selectedEquipmentItem.id ?? '');

  runAction(
    `cook-meat-${rowId}`,
    startCooking(rowId, selectedEquipment, selectedTarget),
    'Cooking started',
    'Failed to Start Cooking'
  );
}

function RawMeatActionControls({
  rowId,
  bestEquipmentSelection,
  selectedTarget,
  targetOptions,
  activeActionIds,
  setTargetByMeat,
  runAction
}: RawMeatActionControlsProps) {
  const selectedEquipmentItem = bestEquipmentSelection?.equipment;
  const cookingEstimate = bestEquipmentSelection?.cookingEstimate;
  const selectedEquipment = String(selectedEquipmentItem?.id ?? '');
  const equipmentLabel = equipmentLabelForSelection(bestEquipmentSelection);
  const isCooking = activeActionIds.has(`cook-meat-${rowId}`);

  return (
    <Flex className="table-actions table-actions-raw" gap={interfaceDimensions.gapSmall} justify="end">
      <Tag
        title={equipmentLabel}
        className="equipment-label"
      >
        {equipmentLabel}
      </Tag>
      <Select
        size="small"
        aria-label="Cooking target"
        value={selectedTarget}
        options={targetOptions}
        onChange={(value) => setTargetByMeat((current) => ({ ...current, [rowId]: value }))}
        className="cooking-target-select"
      />
      <Tag className="duration-label">
        {cookingEstimate ? formatDurationSeconds(cookingEstimate.durationSeconds) : '-'}
      </Tag>
      <Button
        size="small"
        disabled={!selectedEquipment || !cookingEstimate || activeActionIds.size > 0}
        loading={isCooking}
        className="action-button"
        onClick={() =>
          runStartCookingAction({
            rowId,
            selectedTarget,
            bestEquipmentSelection,
            runAction
          })
        }
      >
        {isCooking ? 'Cooking...' : 'Cook'}
      </Button>
    </Flex>
  );
}

function ReadyDashboard({ model }: { model: SignedInModel }) {
  const router = useRouter();
  const { message } = App.useApp();
  const [targetByMeat, setTargetByMeat] = useState<Record<string, string>>({});
  const [seasoningByMeat, setSeasoningByMeat] = useState<Record<string, string>>({});

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const state = model;
  const [isAutoSyncing, setIsAutoSyncing] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => { setIsAutoSyncing(false); }, [model]);

  // Client-side 1-second ticking clock
  useEffect(() => {
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Proactive background auto-sync check when a cooking, spoilage, or shop restock event expires
  useEffect(() => {
    const nowMs = Date.now();

    const hasExpiredCooking = state.cookingJobs.some(
      (j) => new Date(String(j.cooking_target_end_at)).getTime() <= nowMs
    );

    const hasExpiredSpoilage = state.ownedMeats.some(
      (m) =>
        m.current_cooking_state !== 'spoiled' &&
        m.spoilage_due_at &&
        new Date(String(m.spoilage_due_at)).getTime() <= nowMs
    );

    const hasExpiredRestock = state.shopStates.some(
      (s) =>
        s.refresh_due_at &&
        new Date(String(s.refresh_due_at)).getTime() <= nowMs
    );

    if ((hasExpiredCooking || hasExpiredSpoilage || hasExpiredRestock) && !isAutoSyncing) {
      setIsAutoSyncing(true);
      (async () => {
        try {
          await resolveTimeProgress();
          router.refresh();
          // Fallback reset if page update doesn't trigger prop change
          setTimeout(() => {
            setIsAutoSyncing(false);
          }, 6000);
        } catch (e) {
          console.error('Auto-sync failed:', e);
          setTimeout(() => {
            setIsAutoSyncing(false);
          }, 4000);
        }
      })();
    }
  }, [tick, state, isAutoSyncing, router]);

  // Fine-grained loading states tracking Set
  const [activeActionIds, setActiveActionIds] = useState<Set<string>>(new Set());
  const startAction = (id: string) => {
    setActiveActionIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };
  const stopAction = (id: string) => {
    setActiveActionIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  // Centralized action runner with localized loading and error feedback
  async function runAction(
    actionId: string,
    promise: Promise<{ ok: boolean; message?: string }>,
    successMessage: string,
    errorMessagePrefix: string
  ) {
    startAction(actionId);
    try {
      const result = await promise;
      if (!result.ok) {
        message.error(`${errorMessagePrefix}: ${result.message ?? 'Unknown error'}`);
        return;
      }
      message.success(successMessage);
      router.refresh();
    } catch (err) {
      const errMessage = err instanceof Error ? err.message : 'Unknown error';
      message.error(`${errorMessagePrefix}: ${errMessage}`);
    } finally {
      stopAction(actionId);
    }
  }

  // Periodic automatic sync
  useEffect(() => {
    const interval = setInterval(() => {
      resolveTimeProgress().then(() => router.refresh()).catch(() => {
        message.error('Time sync failed. Your last saved state is still shown.');
      });
    }, 15000);

    return () => clearInterval(interval);
  }, [message, router]);

  const meatById = useMemo(
    () => new Map(state.meats.map((item) => [String(item.id), item])),
    [state.meats]
  );
  const seasoningById = useMemo(
    () => new Map(state.seasonings.map((item) => [String(item.id), item])),
    [state.seasonings]
  );
  const shopStateByType = useMemo(
    () => new Map(state.shopStates.map((item) => [String(item.shop_type), item])),
    [state.shopStates]
  );
  const activeModifierIds = new Set(
    state.activeSaleModifiers.filter((modifier) => isSaleModifierActive(modifier)).map((item) => item.definition_id)
  );
  const activeEquipmentCandidates = useMemo(() => {
    const occupiedByEquipment = new Map<string, number>();
    state.cookingJobs.forEach((job) => {
      const equipmentId = String(job.equipment_item_id ?? '');
      occupiedByEquipment.set(equipmentId, (occupiedByEquipment.get(equipmentId) ?? 0) + 1);
    });

    return state.ownedEquipment
      .map((ownedEquipment): EquipmentCandidate | null => {
        const equipment = relation(ownedEquipment, 'equipment_items');
        if (!equipment || ownedEquipment.active === false) {
          return null;
        }

        const equipmentId = String(equipment.id ?? ownedEquipment.equipment_item_id ?? '');
        const quantity = Math.max(0, Number(ownedEquipment.quantity ?? 1) || 0);
        const slotCount = Math.max(0, Number(equipment.cooking_slot_count ?? 1) || 0);
        const totalSlots = quantity * slotCount;
        const occupiedSlots = occupiedByEquipment.get(equipmentId) ?? 0;

        return {
          equipment,
          ownedEquipment,
          totalSlots,
          occupiedSlots,
          freeSlots: Math.max(0, totalSlots - occupiedSlots)
        };
      })
      .filter((item): item is EquipmentCandidate => Boolean(item));
  }, [state.cookingJobs, state.ownedEquipment]);

  if (!mounted) {
    return (
      <Shell>
        <div className="loading-state" role="status">
          <InterfaceIcon icon="lucide:hourglass" />
          <span>Loading dashboard</span>
        </div>
      </Shell>
    );
  }

  const targetOptions = [
    { value: 'cooked', label: 'Cooked' },
    { value: 'well_cooked', label: 'Well Cooked' },
    { value: 'perfectly_cooked', label: 'Perfectly Cooked' }
  ];
  const rawMeats = state.ownedMeats.filter((item) => textValue(item.current_cooking_state) === 'raw');
  const readyMeats = state.ownedMeats.filter((item) => isSaleableCookedState(item.current_cooking_state));
  const heldMeats = state.ownedMeats.filter((item) => {
    const state = textValue(item.current_cooking_state);
    return state !== 'raw' && !SALEABLE_COOKED_STATES.has(state);
  });
  const hasAnySeasonings = state.ownedSeasonings.some(s => Number(s.remaining_uses ?? 0) > 0);

  function shopControls(shopType: 'meat' | 'seasoning') {
    const state = shopStateByType.get(shopType);
    const label = shopType === 'meat' ? 'Meat' : 'Seasoning';

    const isRefreshing = activeActionIds.has(`refresh-${shopType}`);
    const isSpeedUpgrading = activeActionIds.has(`speed-${shopType}`);
    const isLuckUpgrading = activeActionIds.has(`luck-${shopType}`);


    return (
      <div className="shop-controls">
        <Space wrap>
          <Tag>Stage {numberValue(state?.shop_stage, 0)}</Tag>
          <Tag>Luck {numberValue(state?.luck_level, 0)}</Tag>
          <Tag>Refresh {numberValue(state?.refresh_speed_level, 0)}</Tag>
          <Tag>Next {state?.refresh_due_at ? formatCountdown(String(state.refresh_due_at)) : '-'}</Tag>
        </Space>
        <Space wrap>
          <Button
            size="small"
            loading={isRefreshing}
            disabled={activeActionIds.size > 0}
            className="action-button"
            icon={<InterfaceIcon icon="lucide:refresh-cw" />}
            onClick={() =>
              runAction(
                `refresh-${shopType}`,
                manualRefreshShop(shopType),
                `${label} shop refreshed`,
                `Failed to Refresh ${label} Shop`
              )
            }
          >
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
          <Button
            size="small"
            loading={isSpeedUpgrading}
            disabled={activeActionIds.size > 0}
            className="action-button"
            icon={<InterfaceIcon icon="lucide:timer" />}
            onClick={() =>
              runAction(
                `speed-${shopType}`,
                buyShopRefreshSpeed(shopType),
                'Refresh speed upgraded',
                `Failed to Upgrade ${label} Speed`
              )
            }
          >
            {isSpeedUpgrading ? 'Upgrading...' : 'Speed'}
          </Button>
          <Button
            size="small"
            loading={isLuckUpgrading}
            disabled={activeActionIds.size > 0}
            className="action-button"
            icon={<InterfaceIcon icon="lucide:sparkles" />}
            onClick={() =>
              runAction(
                `luck-${shopType}`,
                buyShopLuck(shopType),
                'Luck upgraded',
                `Failed to Upgrade ${label} Luck`
              )
            }
          >
            {isLuckUpgrading ? 'Upgrading...' : 'Luck'}
          </Button>
        </Space>
      </div>
    );
  }

  const renderStockBadge = (row: Row) => {
    if (row.starter_only) {
      return (
        <Tag
          className="stock-tag" data-status="unlimited"
        >
          Unlimited
        </Tag>
      );
    }
    const current = Number(row.current_stock ?? 0);
    const maximum = Number(row.maximum_stock ?? 10);

    if (current === 0) {
      return (
        <Tag
          className="stock-tag" data-status="empty"
        >
          Out of stock
        </Tag>
      );
    }

    if (current <= 2) {
      return (
        <Tag
          className="stock-tag" data-status="low"
        >
          {current} / {maximum} (Low)
        </Tag>
      );
    }

    return (
      <Tag
        className="stock-tag" data-status="available"
      >
        {current} / {maximum}
      </Tag>
    );
  };

  const meatColumns: ColumnsType<Row> = [
    {
      title: 'Meat',
      dataIndex: 'display_name',
      render: (_, row) =>
        formatMeatName(textValue(row.display_name ?? meatById.get(String(row.item_id))?.display_name, textValue(row.item_id)))
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
      title: 'Stock',
      key: 'stock',
      width: interfaceDimensions.columns.stock,
      render: (_, row) => renderStockBadge(row)
    },
    {
      title: '',
      width: interfaceDimensions.columns.action,
      render: (_, row) => {
        const isStarter = Boolean(row.starter_only);
        const hasStock = isStarter || Number(row.current_stock ?? 0) > 0;
        const itemId = String(row.item_id ?? row.id);
        const isBuying = activeActionIds.has(`buy-meat-${itemId}`);
        return (
          <div className="table-actions">
            {hasStock ? (
              <Button
                size="small"
                type="primary"
                loading={isBuying}
                disabled={activeActionIds.size > 0}
                className="action-button"
                onClick={() =>
                  runAction(
                    `buy-meat-${itemId}`,
                    buyMeat(itemId),
                    'Meat bought',
                    'Failed to Buy Meat'
                  )
                }
              >
                {isBuying ? 'Unpacking...' : 'Buy'}
              </Button>
            ) : (
              <Text type="secondary">Out of stock</Text>
            )}
          </div>
        );
      }
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
      title: 'Speed',
      dataIndex: 'cooking_speed_multiplier',
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
      width: interfaceDimensions.columns.action,
      render: (_, row) => {
        const itemId = String(row.id);
        const isBuying = activeActionIds.has(`buy-equipment-${itemId}`);
        return (
          <div className="table-actions">
            <Button
              size="small"
              loading={isBuying}
              disabled={activeActionIds.size > 0}
              className="action-button"
              onClick={() =>
                runAction(
                  `buy-equipment-${itemId}`,
                  buyEquipment(itemId),
                  'Equipment bought',
                  'Failed to Buy Equipment'
                )
              }
            >
              {isBuying ? 'Buying...' : 'Buy'}
            </Button>
          </div>
        );
      }
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
      title: 'Stock',
      key: 'stock',
      width: interfaceDimensions.columns.stock,
      render: (_, row) => renderStockBadge(row)
    },
    {
      title: '',
      width: interfaceDimensions.columns.action,
      render: (_, row) => {
        const hasStock = Number(row.current_stock ?? 0) > 0;
        const itemId = String(row.item_id ?? row.id);
        const isBuying = activeActionIds.has(`buy-seasoning-${itemId}`);
        return (
          <div className="table-actions">
            {hasStock ? (
              <Button
                size="small"
                loading={isBuying}
                disabled={activeActionIds.size > 0}
                className="action-button"
                onClick={() =>
                  runAction(
                    `buy-seasoning-${itemId}`,
                    buySeasoning(itemId),
                    'Seasoning bought',
                    'Failed to Buy Seasoning'
                  )
                }
              >
                {isBuying ? 'Buying...' : 'Buy'}
              </Button>
            ) : (
              <Text type="secondary">Out of stock</Text>
            )}
          </div>
        );
      }
    }
  ];

  const getMeatColumns = (tableType: 'raw' | 'ready' | 'held'): ColumnsType<Row> => {
    return [
      {
        title: 'Meat',
        width: interfaceDimensions.columns.meat,
        render: (_, row) => {
          return formatMeatName(textValue(relation(row, 'meat_items')?.display_name, textValue(row.meat_item_id)));
        }
      },
      {
        title: 'Weight',
        dataIndex: 'spawned_weight',
        align: 'right',
        width: interfaceDimensions.columns.weight,
        render: formatWeightKg
      },
      {
        title: 'State',
        dataIndex: 'current_cooking_state',
        width: interfaceDimensions.columns.state,
        render: (value) => <Tag>{formatState(value)}</Tag>
      },
      {
        title: 'Spoils',
        dataIndex: 'spoilage_due_at',
        width: interfaceDimensions.columns.countdown,
        className: 'column-nowrap',
        render: (value, row) => {
          if (row.current_cooking_state === 'spoiled') {
            return 'Spoiled';
          }
          return value ? formatCountdown(String(value)) : '-';
        }
      },
      {
        title: 'Roll',
        dataIndex: 'weight_rarity_result',
        width: interfaceDimensions.columns.rarity,
        render: (value) => <Tag color={rarityColor(value)}>{formatState(value)}</Tag>
      },
      {
        title: '',
        render: (_, row) => {
          const rowId = String(row.id);
          const selectedTarget = targetByMeat[rowId] ?? 'perfectly_cooked';
          const meatItem = relation(row, 'meat_items') ?? meatById.get(String(row.meat_item_id));
          const bestEquipmentSelection = selectBestEquipmentForRow(
            row,
            selectedTarget,
            activeEquipmentCandidates,
            meatItem
          );

          const appliedIds = new Set(
            ((row.applied_seasonings as { seasoning_instance_id: string }[] | undefined) ?? []).map(
              (as) => String(as.seasoning_instance_id)
            )
          );
          const availableSeasonings = state.ownedSeasonings.filter(
            (s) => !appliedIds.has(String(s.id)) && Number(s.remaining_uses ?? 0) > 0
          );
          const selectedSeasoning = availableSeasonings.some((s) => String(s.id) === seasoningByMeat[rowId])
            ? seasoningByMeat[rowId]
            : String(availableSeasonings[0]?.id ?? '');

          const seasoningOptionsForMeat = availableSeasonings.map((s) => ({
            value: String(s.id),
            label: `${textValue(relation(s as Row, 'seasoning_items')?.display_name, String(s.id))} (${s.remaining_uses}/${s.maximum_uses})`
          }));

          const isSeasoning = activeActionIds.has(`season-meat-${rowId}`);
          const isSelling = activeActionIds.has(`sell-meat-${rowId}`);

          if (tableType === 'raw') {
            return (
              <RawMeatActionControls
                rowId={rowId}
                bestEquipmentSelection={bestEquipmentSelection}
                selectedTarget={selectedTarget}
                targetOptions={targetOptions}
                activeActionIds={activeActionIds}
                setTargetByMeat={setTargetByMeat}
                runAction={runAction}
              />
            );
          }

          if (tableType === 'ready') {
            const hasSeasonings = availableSeasonings.length > 0;
            return (
              <Flex className={`table-actions ${hasSeasonings ? 'table-actions-ready-season' : 'table-actions-ready-sell'}`} gap={interfaceDimensions.gapSmall} justify="end">
                {hasSeasonings && (
                  <>
                    <Select
                      size="small"
                      aria-label="Seasoning selection"
                      value={selectedSeasoning || undefined}
                      placeholder="Seasoning"
                      options={seasoningOptionsForMeat}
                      onChange={(value) => setSeasoningByMeat((current) => ({ ...current, [rowId]: value }))}
                      className="seasoning-select"
                    />
                    <Button
                      size="small"
                      disabled={!selectedSeasoning || activeActionIds.size > 0}
                      loading={isSeasoning}
                      className="action-button"
                      onClick={() =>
                        runAction(
                          `season-meat-${rowId}`,
                          applySeasoning(rowId, selectedSeasoning),
                          'Seasoning applied',
                          'Failed to Apply Seasoning'
                        )
                      }
                    >
                      {isSeasoning ? 'Seasoning...' : 'Season'}
                    </Button>
                  </>
                )}
                <Button
                  size="small"
                  type="primary"
                  loading={isSelling}
                  disabled={activeActionIds.size > 0}
                  className="action-button"
                  onClick={() => {
                    runAction(
                      `sell-meat-${rowId}`,
                      sellMeat(rowId),
                      'Meat sold',
                      'Failed to Sell Meat'
                    );
                  }}
                >
                  {isSelling ? 'Selling...' : 'Sell'}
                </Button>
              </Flex>
            );
          }

          // tableType === 'held'
          return (
            <Flex className="table-actions table-actions-held" gap={interfaceDimensions.gapSmall} justify="end">
              <Tag>Not ready</Tag>
            </Flex>
          );
        }
      }
    ];
  };

  const isSyncing = activeActionIds.has('sync-time');

  return (
    <Shell
      right={
        <Space wrap>
          <Button
            loading={isSyncing}
            disabled={activeActionIds.size > 0}
            className="action-button"
            icon={<InterfaceIcon icon="lucide:refresh-cw" />}
            onClick={() =>
              runAction(
                'sync-time',
                resolveTimeProgress(),
                'Time progress resolved',
                'Failed to Sync Time'
              )
            }
          >
            {isSyncing ? 'Syncing...' : 'Sync time'}
          </Button>
          <form action={signOut}>
            <Button htmlType="submit" icon={<InterfaceIcon icon="lucide:log-out" />}>
              Sign out
            </Button>
          </form>
        </Space>
      }
    >
      <div className="stat-grid">
        <Card className="balance-card">
          <Statistic title={<span className="stat-label"><InterfaceIcon icon="lucide:wallet" />Balance</span>} value={money(state.save?.balance)} />
        </Card>
        <Card>
          <Statistic title={<span className="stat-label"><InterfaceIcon icon="lucide:beef" />Unsold meat</span>} value={state.ownedMeats.length} />
        </Card>
        <Card>
          <Statistic title={<span className="stat-label"><InterfaceIcon icon="lucide:flame" />Active cooking jobs</span>} value={state.cookingJobs.length} />
        </Card>
        <Card className="best-sale-card">
          <Statistic title={<span className="stat-label"><InterfaceIcon icon="lucide:trending-up" />Best sale</span>} value={money(state.stats?.best_sale_value)} />
        </Card>
      </div>

      <AccountAccess user={state.user} />

      {state.saleModifierDefinitions.length > 0 && (
        <div className="modifier-strip">
          <Space wrap>
            <PanelTitle icon="lucide:badge-percent">Sale modifiers</PanelTitle>
            {state.saleModifierDefinitions.map((modifier) => {
              const modifierId = String(modifier.id);
              const isActive = activeModifierIds.has(modifierId);
              const isClaiming = activeActionIds.has(`claim-modifier-${modifierId}`);

              return (
                <Button
                  key={modifierId}
                  size="small"
                  disabled={isActive || activeActionIds.size > 0}
                  loading={isClaiming}
                  className="action-button"
                  icon={<InterfaceIcon icon={isActive ? 'lucide:badge-check' : 'lucide:badge-plus'} />}
                  onClick={() =>
                    runAction(
                      `claim-modifier-${modifierId}`,
                      claimSaleModifier(modifierId),
                      'Sale modifier claimed',
                      'Failed to Claim Sale Modifier'
                    )
                  }
                >
                  <span className="modifier-label">
                    <span aria-hidden={isClaiming} data-visible={!isClaiming}>
                      {`${textValue(modifier.display_name, modifierId)} ${numberValue(Number(modifier.multiplier) * 100, 0)}%`}
                    </span>
                    <span aria-hidden={!isClaiming} data-visible={isClaiming}>Claiming...</span>
                  </span>
                </Button>
              );
            })}
          </Space>
        </div>
      )}

      <Tabs
        className="workspace-tabs"
        items={[
          {
            key: 'kitchen',
            label: <span className="tab-label"><InterfaceIcon icon="lucide:cooking-pot" />Kitchen</span>,
            children: (
              <Flex className="kitchen-workspace" gap={interfaceDimensions.gap} align="start">
                <Flex className="meat-flow" vertical gap={interfaceDimensions.gap}>
                  <Card title={<PanelTitle icon="lucide:beef">Raw meat</PanelTitle>} extra={<Tag>Cook before sale</Tag>}>
                    <Table
                      rowKey="id"
                      size="small"
                      columns={getMeatColumns('raw')}
                      dataSource={rawMeats}
                      pagination={{ pageSize: 6, showSizeChanger: false }}
                      scroll={{ x: interfaceDimensions.tables.raw }}
                    />
                  </Card>
                  {heldMeats.length > 0 && (
                    <Card title={<PanelTitle icon="lucide:circle-alert">Needs attention</PanelTitle>}>
                      <Table
                        rowKey="id"
                        size="small"
                        columns={getMeatColumns('held')}
                        dataSource={heldMeats}
                        pagination={{ pageSize: 4, showSizeChanger: false }}
                        scroll={{ x: interfaceDimensions.tables.held }}
                      />
                    </Card>
                  )}
                </Flex>
                <Flex className="meat-flow" vertical gap={interfaceDimensions.gap}>
                  <Card title={<PanelTitle icon="lucide:cooking-pot">Active cooking</PanelTitle>}>
                    {state.cookingJobs.length ? (
                      <Table<Row>
                        rowKey="id"
                        size="small"
                        dataSource={state.cookingJobs}
                        pagination={false}
                        scroll={{ x: interfaceDimensions.tables.cooking }}
                        columns={[
                          {
                            title: 'Meat',
                            render: (_, row) => {
                              const displayName = relation(relation(row, 'meat_instances') ?? {}, 'meat_items')?.display_name;
                              if (displayName) {
                                return formatMeatName(String(displayName));
                              }
                              const instance = state.ownedMeats.find(m => String(m.id) === String(row.meat_instance_id));
                              if (instance) {
                                const mId = String(instance.meat_item_id);
                                const catMeat = meatById.get(mId);
                                if (catMeat?.display_name) {
                                  return formatMeatName(String(catMeat.display_name));
                                }
                                return formatMeatName(mId);
                              }
                              return 'Meat';
                            }
                          },
                          {
                            title: 'Target',
                            dataIndex: 'target_cooking_state',
                            render: formatState
                          },
                          {
                            title: 'Progress',
                            render: (_, row) => {
                              const start = new Date(String(row.cooking_started_at)).getTime();
                              const end = new Date(String(row.cooking_target_end_at)).getTime();
                              const now = Date.now();
                              const total = end - start;
                              const elapsed = now - start;
                              const percent = Math.min(100, Math.max(0, (elapsed / (total || 1)) * 100));
                              const countdown = formatCountdown(String(row.cooking_target_end_at));

                              return (
                                <div className="cooking-progress">
                                  <Progress
                                    percent={Math.round(percent)}
                                    size="small"
                                    status={percent >= 100 ? 'success' : 'active'}
                                  />
                                  <div className="cooking-countdown">
                                    {countdown}
                                  </div>
                                </div>
                              );
                            }
                          }
                        ]}
                      />
                    ) : (
                      <p className="empty-detail">No meat is cooking.</p>
                    )}
                  </Card>
                  <Card
                    title={<PanelTitle icon="lucide:badge-dollar-sign">Ready to sell</PanelTitle>}
                    extra={
                      (() => {
                        const isSellingAll = activeActionIds.has('sell-all-meat');
                        const isSeasoningAll = activeActionIds.has('season-all-meat');
                        return (
                          <Space>
                            <Button
                              size="small"
                              type="primary"
                              loading={isSellingAll}
                              disabled={readyMeats.length === 0 || activeActionIds.size > 0}
                              className="action-button"
                              icon={<InterfaceIcon icon="lucide:badge-dollar-sign" />}
                              onClick={() => {
                                runAction(
                                  'sell-all-meat',
                                  sellAllMeat(),
                                  'Cooked meat sold',
                                  'Failed to Sell All Meat'
                                );
                              }}
                            >
                              {isSellingAll ? 'Selling...' : 'Sell all'}
                            </Button>
                            <Button
                              size="small"
                              className="action-button season-all-button"
                              loading={isSeasoningAll}
                              disabled={readyMeats.length === 0 || state.ownedSeasonings.length === 0 || activeActionIds.size > 0}
                              icon={<InterfaceIcon icon="lucide:sparkles" />}
                              onClick={() => {
                                runAction(
                                  'season-all-meat',
                                  seasonAllMeat(),
                                  'All cooked meats seasoned',
                                  'Failed to Season All Meat'
                                );
                              }}
                            >
                              {isSeasoningAll ? 'Seasoning...' : 'Season all'}
                            </Button>
                          </Space>
                        );
                      })()
                    }
                  >
                    <Table
                      rowKey="id"
                      size="small"
                      columns={getMeatColumns('ready')}
                      dataSource={readyMeats}
                      pagination={{ pageSize: 6, showSizeChanger: false }}
                      scroll={{ x: hasAnySeasonings ? interfaceDimensions.tables.ready : interfaceDimensions.tables.held }}
                    />
                  </Card>
                </Flex>
              </Flex>
            )
          },
          {
            key: 'meat-shop',
            label: <span className="tab-label"><InterfaceIcon icon="lucide:store" />Meat Shop</span>,
            children: (
              <>
                {shopControls('meat')}
                <Card title={<PanelTitle icon="lucide:store">Available meat</PanelTitle>}>
                  <Table
                    rowKey={(row) => String(row.id ?? row.item_id)}
                    size="small"
                    columns={meatColumns}
                    dataSource={[
                      ...state.meats.filter((item) => item.starter_only),
                      ...state.meatStock
                    ]}
                    pagination={{ pageSize: 12, showSizeChanger: false }}
                    scroll={{ x: interfaceDimensions.tables.shop }}
                  />
                </Card>
              </>
            )
          },
          {
            key: 'seasoning-shop',
            label: <span className="tab-label"><InterfaceIcon icon="lucide:leaf" />Seasoning Shop</span>,
            children: (
              <>
                {shopControls('seasoning')}
                <Card title={<PanelTitle icon="lucide:leaf">Available seasonings</PanelTitle>}>
                  <Table
                    rowKey={(row) => String(row.id ?? row.item_id)}
                    size="small"
                    columns={seasoningColumns}
                    dataSource={state.seasoningStock}
                    pagination={{ pageSize: 10, showSizeChanger: false }}
                    scroll={{ x: interfaceDimensions.tables.shop }}
                  />
                </Card>
              </>
            )
          },
          {
            key: 'equipment-shop',
            label: <span className="tab-label"><InterfaceIcon icon="lucide:utensils" />Equipment Shop</span>,
            children: (
              <Card title={<PanelTitle icon="lucide:utensils">Equipment catalog</PanelTitle>}>
                <Table
                  rowKey="id"
                  size="small"
                  columns={equipmentColumns}
                  dataSource={state.equipment}
                  pagination={{ pageSize: 12, showSizeChanger: false }}
                  scroll={{ x: interfaceDimensions.tables.equipment }}
                />
              </Card>
            )
          },
          {
            key: 'inventory',
            label: <span className="tab-label"><InterfaceIcon icon="lucide:archive" />Inventory</span>,
            children: (
              <div className="panel-grid">
                <Card title={<PanelTitle icon="lucide:archive">Owned equipment</PanelTitle>}>
                  <Table<Row>
                    rowKey={(row) => String(row.equipment_item_id)}
                    size="small"
                    dataSource={state.ownedEquipment}
                    pagination={false}
                    scroll={{ x: interfaceDimensions.tables.inventory }}
                    columns={[
                      {
                        title: 'Equipment',
                        render: (_, row) =>
                          textValue(relation(row, 'equipment_items')?.display_name, textValue(row.equipment_item_id))
                      },
                      {
                        title: 'Qty',
                        render: (_, row) => Number(row.quantity ?? 1),
                        align: 'right'
                      },
                      {
                        title: 'Slots',
                        render: (_, row) => Number(relation(row, 'equipment_items')?.cooking_slot_count ?? 1) * Number(row.quantity ?? 1),
                        align: 'right'
                      },
                      {
                        title: 'Multiplier',
                        render: (_, row) => `${numberValue(relation(row, 'equipment_items')?.price_multiplier)}x`,
                        align: 'right'
                      },
                      {
                        title: '',
                        width: interfaceDimensions.columns.action,
                        render: (_, row) => {
                          const eqId = String(row.equipment_item_id);
                          const isDestroying = activeActionIds.has(`destroy-equipment-${eqId}`);
                          return (
                            <div className="table-actions">
                              <Button
                                size="small"
                                danger
                                loading={isDestroying}
                                disabled={activeActionIds.size > 0}
                                className="action-button"
                                onClick={() =>
                                  runAction(
                                    `destroy-equipment-${eqId}`,
                                    destroyEquipment(eqId),
                                    'Equipment destroyed',
                                    'Failed to Destroy Equipment'
                                  )
                                }
                              >
                                {isDestroying ? 'Destroying...' : 'Destroy'}
                              </Button>
                            </div>
                          );
                        }
                      }
                    ]}
                  />
                </Card>
                <Card title={<PanelTitle icon="lucide:package">Owned seasonings</PanelTitle>}>
                  <Table<Row>
                    rowKey="id"
                    size="small"
                    dataSource={state.ownedSeasonings}
                    pagination={{ pageSize: 8, showSizeChanger: false }}
                    scroll={{ x: interfaceDimensions.tables.inventory }}
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
                        width: interfaceDimensions.columns.action,
                        render: (_, row) => {
                          const seasoningInstId = String(row.id);
                          const isSellingSeasoning = activeActionIds.has(`sell-seasoning-${seasoningInstId}`);
                          return (
                            <div className="table-actions">
                              <Button
                                size="small"
                                loading={isSellingSeasoning}
                                disabled={activeActionIds.size > 0}
                                className="action-button"
                                onClick={() =>
                                  runAction(
                                    `sell-seasoning-${seasoningInstId}`,
                                    sellSeasoning(seasoningInstId),
                                    'Seasoning sold',
                                    'Failed to Sell Seasoning'
                                  )
                                }
                              >
                                {isSellingSeasoning ? 'Selling...' : 'Sell back'}
                              </Button>
                            </div>
                          );
                        }
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
