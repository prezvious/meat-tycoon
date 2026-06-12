'use client';

import { useEffect, useMemo, useState, useTransition, useOptimistic } from 'react';
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
  Progress,
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
import {
  calculateEffectiveEquipmentSaleMultiplier,
  calculateSaleValue,
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
    baseMeatValue: Number(meatItem?.base_meat_value ?? row.base_meat_value_snapshot ?? 0),
    categoryMultiplier: Number(meatItem?.category_multiplier ?? 1),
    purchasePricePaid: Number(row.purchase_price_paid ?? 0)
  };
}

function effectiveEquipmentMultiplierForMeat(meatItem: Row | undefined, equipmentItem: Row | undefined) {
  return calculateEffectiveEquipmentSaleMultiplier({
    priceMultiplier: equipmentItem?.price_multiplier ?? 1,
    meatEquipmentTags: arrayValue(meatItem?.equipment_compatibility_tags),
    equipmentTags: arrayValue(equipmentItem?.equipment_tags)
  });
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

type DashboardAction =
  | { type: 'BUY_MEAT'; tempId: string; price: number; meatItemId: string; displayName: string }
  | { type: 'BUY_SEASONING'; tempId: string; price: number; seasoningItemId: string; displayName: string; maximumUses: number; baseMultiplier: number }
  | { type: 'BUY_EQUIPMENT'; price: number; equipmentId: string; displayName: string; equipmentType: string; cookingSlotCount: number; priceMultiplier: number; cookingSpeedMultiplier: number }
  | { type: 'START_COOKING'; meatInstanceId: string; equipmentId: string; targetCookingState: string; durationSeconds: number; defaultCookingSeconds: number; preEquipmentCookingSeconds: number; equipmentSpeedMultiplier: number; longCookMultiplier: number; tempJobId: string; meatDisplayName: string; equipmentDisplayName: string }
  | { type: 'APPLY_SEASONING'; meatInstanceId: string; seasoningInstanceId: string; seasoningItemId?: string }
  | { type: 'SELL_MEAT'; meatInstanceId: string; estimatedPrice: number }
  | { type: 'SELL_ALL_MEAT'; totalPrice: number }
  | { type: 'SEASON_ALL_MEAT' }
  | { type: 'DESTROY_EQUIPMENT'; equipmentId: string }
  | { type: 'SELL_SEASONING'; seasoningInstanceId: string; estimatedRefund: number }
  | { type: 'CLAIM_MODIFIER'; modifierId: string }
  | { type: 'MANUAL_REFRESH_SHOP'; shopType: string; cost: number }
  | { type: 'UPGRADE_SHOP'; shopType: string; upgradeType: 'luck' | 'speed'; cost: number };

type RunDashboardAction = (
  actionId: string,
  optimisticPayload: DashboardAction | null,
  promise: Promise<{ ok: boolean; message?: string }>,
  successMessage: string,
  errorMessagePrefix: string
) => void;
type StartCookingActionArgs = {
  row: Row;
  rowId: string;
  selectedTarget: string;
  bestEquipmentSelection: BestCookingEquipmentSelection | null;
  runAction: RunDashboardAction;
};

type RawMeatActionControlsProps = {
  row: Row;
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
  row,
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
  const eqName = textValue(selectedEquipmentItem.display_name, 'Equipment');
  const rawMeatName = relation(row, 'meat_items')?.display_name ?? row.meat_item_id ?? 'Meat';
  const meatDisplayName = formatMeatName(textValue(rawMeatName, 'Meat'));

  runAction(
    `cook-meat-${rowId}`,
    {
      type: 'START_COOKING',
      meatInstanceId: rowId,
      equipmentId: selectedEquipment,
      targetCookingState: selectedTarget,
      durationSeconds: cookingEstimate.durationSeconds,
      defaultCookingSeconds: cookingEstimate.defaultCookingSeconds,
      preEquipmentCookingSeconds: cookingEstimate.preEquipmentSeconds,
      equipmentSpeedMultiplier: cookingEstimate.equipmentSpeedMultiplier,
      longCookMultiplier: cookingEstimate.longCookMultiplier,
      tempJobId: `temp-job-${Date.now()}`,
      meatDisplayName,
      equipmentDisplayName: eqName
    },
    startCooking(rowId, selectedEquipment, selectedTarget),
    'Cooking started',
    'Failed to Start Cooking'
  );
}

function RawMeatActionControls({
  row,
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
    <Flex className="table-actions table-actions-raw" gap={8} justify="end">
      <Tag
        title={equipmentLabel}
        style={{
          marginInlineEnd: 0,
          minWidth: 160,
          maxWidth: 220,
          overflow: 'hidden',
          textAlign: 'center',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}
      >
        {equipmentLabel}
      </Tag>
      <Select
        size="small"
        aria-label="Cooking target"
        value={selectedTarget}
        options={targetOptions}
        onChange={(value) => setTargetByMeat((current) => ({ ...current, [rowId]: value }))}
        style={{ width: 140 }}
      />
      <Tag style={{ marginInlineEnd: 0, minWidth: 58, textAlign: 'center' }}>
        {cookingEstimate ? formatDurationSeconds(cookingEstimate.durationSeconds) : '-'}
      </Tag>
      <Button
        size="small"
        disabled={!selectedEquipment || !cookingEstimate || activeActionIds.size > 0}
        loading={isCooking}
        style={{ minWidth: isCooking ? 85 : 60 }}
        onClick={() =>
          runStartCookingAction({
            row,
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
  const [, startTransition] = useTransition();
  const [targetByMeat, setTargetByMeat] = useState<Record<string, string>>({});
  const [seasoningByMeat, setSeasoningByMeat] = useState<Record<string, string>>({});

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Unified Client State synchronized with model prop
  const [clientState, setClientState] = useState<SignedInModel>(model);
  const [isAutoSyncing, setIsAutoSyncing] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setClientState(model);
    setIsAutoSyncing(false); // Reset auto-sync flag when we receive new server data
  }, [model]);

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

    const hasExpiredCooking = clientState.cookingJobs.some(
      (j) => new Date(String(j.cooking_target_end_at)).getTime() <= nowMs
    );

    const hasExpiredSpoilage = clientState.ownedMeats.some(
      (m) =>
        m.current_cooking_state !== 'spoiled' &&
        m.spoilage_due_at &&
        new Date(String(m.spoilage_due_at)).getTime() <= nowMs
    );

    const hasExpiredRestock = clientState.shopStates.some(
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
  }, [tick, clientState, isAutoSyncing, router]);

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

  // Optimistic Reducer
  const [optimisticState, setOptimisticState] = useOptimistic(
    clientState,
    (currentState, action: DashboardAction): SignedInModel => {
      switch (action.type) {
        case 'BUY_MEAT': {
          const newMeat = {
            id: action.tempId,
            user_id: currentState.user.id,
            meat_item_id: action.meatItemId,
            purchase_price_paid: action.price,
            spawned_weight: 1.0,
            weight_rarity_result: 'normal',
            current_cooking_state: 'raw',
            created_at: new Date().toISOString(),
            display_name_override: `${action.displayName} (Unpacking...)`,
            isPlaceholder: true,
            meat_items: {
              display_name: `${action.displayName} (Unpacking...)`,
              category: 'Starter'
            }
          };
          return {
            ...currentState,
            save: currentState.save ? { ...currentState.save, balance: Number(currentState.save.balance) - action.price } : null,
            ownedMeats: [newMeat, ...currentState.ownedMeats],
            meatStock: currentState.meatStock.map(s =>
              String(s.item_id) === String(action.meatItemId)
                ? { ...s, current_stock: Math.max(0, Number(s.current_stock ?? 0) - 1) }
                : s
            )
          };
        }

        case 'BUY_SEASONING': {
          const newSeasoning = {
            id: action.tempId,
            user_id: currentState.user.id,
            seasoning_item_id: action.seasoningItemId,
            remaining_uses: action.maximumUses,
            maximum_uses: action.maximumUses,
            acquired_at: new Date().toISOString(),
            seasoning_items: {
              display_name: action.displayName,
              base_multiplier: action.baseMultiplier,
              maximum_uses: action.maximumUses
            }
          };
          return {
            ...currentState,
            save: currentState.save ? { ...currentState.save, balance: Number(currentState.save.balance) - action.price } : null,
            ownedSeasonings: [newSeasoning, ...currentState.ownedSeasonings],
            seasoningStock: currentState.seasoningStock.map(s =>
              String(s.item_id) === String(action.seasoningItemId)
                ? { ...s, current_stock: Math.max(0, Number(s.current_stock ?? 0) - 1) }
                : s
            )
          };
        }

        case 'BUY_EQUIPMENT': {
          const newOwnedEquipment = currentState.ownedEquipment.map((e) => {
            if (String(e.equipment_item_id) === String(action.equipmentId)) {
              return {
                ...e,
                quantity: Number(e.quantity ?? 1) + 1
              };
            }
            return e;
          });

          const alreadyOwned = currentState.ownedEquipment.some(
            (e) => String(e.equipment_item_id) === String(action.equipmentId)
          );

          const finalOwned = alreadyOwned
            ? newOwnedEquipment
            : [
                ...currentState.ownedEquipment,
                {
                  user_id: currentState.user.id,
                  equipment_item_id: action.equipmentId,
                  active: true,
                  acquired_at: new Date().toISOString(),
                  quantity: 1,
                  equipment_items: {
                    id: action.equipmentId,
                    display_name: action.displayName,
                    equipment_type: action.equipmentType,
                    purchase_price: action.price,
                    price_multiplier: action.priceMultiplier,
                    cooking_speed_multiplier: action.cookingSpeedMultiplier,
                    cooking_slot_count: action.cookingSlotCount
                  }
                }
              ];

          return {
            ...currentState,
            save: currentState.save ? { ...currentState.save, balance: Number(currentState.save.balance) - action.price } : null,
            ownedEquipment: finalOwned
          };
        }

        case 'START_COOKING': {
          const currentMeat = currentState.ownedMeats.find(m => String(m.id) === String(action.meatInstanceId));
          const updatedMeats = currentState.ownedMeats.map(m =>
            String(m.id) === String(action.meatInstanceId)
              ? { ...m, current_cooking_state: 'cooking' }
              : m
          );
          const newJob = {
            id: action.tempJobId,
            user_id: currentState.user.id,
            meat_instance_id: action.meatInstanceId,
            equipment_item_id: action.equipmentId,
            equipment_slot_index: 0,
            cooking_started_at: new Date().toISOString(),
            cooking_target_end_at: new Date(Date.now() + action.durationSeconds * 1000).toISOString(),
            cooking_duration_seconds: action.durationSeconds,
            default_cooking_seconds_snapshot: action.defaultCookingSeconds,
            pre_equipment_cooking_seconds_snapshot: action.preEquipmentCookingSeconds,
            equipment_speed_multiplier_snapshot: action.equipmentSpeedMultiplier,
            long_cook_multiplier_snapshot: action.longCookMultiplier,
            target_cooking_state: action.targetCookingState,
            cooking_completed: false,
            meat_instances: {
              id: action.meatInstanceId,
              meat_items: {
                display_name: currentMeat ? textValue(relation(currentMeat as Row, 'meat_items')?.display_name, 'Meat') : 'Meat'
              }
            },
            equipment_items: {
              id: action.equipmentId,
              display_name: action.equipmentDisplayName
            }
          };
          return {
            ...currentState,
            ownedMeats: updatedMeats.map(m =>
              String(m.id) === String(action.meatInstanceId)
                ? { ...m, long_cook_multiplier_snapshot: action.longCookMultiplier }
                : m
            ),
            cookingJobs: [...currentState.cookingJobs, newJob]
          };
        }

        case 'APPLY_SEASONING': {
          const targetSeasoning = currentState.ownedSeasonings.find(s => String(s.id) === String(action.seasoningInstanceId));
          const updatedSeasonings = currentState.ownedSeasonings.map(s =>
            String(s.id) === String(action.seasoningInstanceId)
              ? { ...s, remaining_uses: Math.max(0, Number(s.remaining_uses ?? 0) - 1) }
              : s
          ).filter(s => Number(s.remaining_uses) > 0);

          const updatedMeats = currentState.ownedMeats.map(m => {
            if (m.id === action.meatInstanceId) {
              const applied = (m['applied_seasonings'] as unknown[]) ?? [];
              const seasoningItem = targetSeasoning ? relation(targetSeasoning as Row, 'seasoning_items') : undefined;
              return {
                ...m,
                applied_seasonings: [
                  ...applied,
                  {
                    seasoning_instance_id: String(action.seasoningInstanceId),
                    baseMultiplier: Number(seasoningItem?.base_multiplier ?? 1),
                    remainingUses: 1,
                    maximumUses: 1
                  }
                ]
              };
            }
            return m;
          });

          return {
            ...currentState,
            ownedSeasonings: updatedSeasonings,
            ownedMeats: updatedMeats
          };
        }

        case 'SELL_MEAT': {
          return {
            ...currentState,
            save: currentState.save ? { ...currentState.save, balance: Number(currentState.save.balance) + action.estimatedPrice } : null,
            ownedMeats: currentState.ownedMeats.filter(m => String(m.id) !== String(action.meatInstanceId))
          };
        }

        case 'SELL_ALL_MEAT': {
          return {
            ...currentState,
            save: currentState.save ? { ...currentState.save, balance: Number(currentState.save.balance) + action.totalPrice } : null,
            ownedMeats: currentState.ownedMeats.filter(m => !isSaleableCookedState(m.current_cooking_state))
          };
        }

        case 'SEASON_ALL_MEAT': {
          return currentState;
        }

        case 'DESTROY_EQUIPMENT': {
          const finalOwned = currentState.ownedEquipment.map((e) => {
            if (String(e.equipment_item_id) === String(action.equipmentId)) {
              return {
                ...e,
                quantity: Math.max(0, Number(e.quantity ?? 1) - 1)
              };
            }
            return e;
          }).filter((e) => Number(e.quantity ?? 1) > 0);

          return {
            ...currentState,
            ownedEquipment: finalOwned
          };
        }

        case 'SELL_SEASONING': {
          return {
            ...currentState,
            save: currentState.save ? { ...currentState.save, balance: Number(currentState.save.balance) + action.estimatedRefund } : null,
            ownedSeasonings: currentState.ownedSeasonings.filter(s => String(s.id) !== String(action.seasoningInstanceId))
          };
        }

        case 'CLAIM_MODIFIER': {
          const modDef = currentState.saleModifierDefinitions.find(d => String(d.id) === String(action.modifierId));
          const newActive = modDef ? {
            id: `temp-active-${Date.now()}`,
            user_id: currentState.user.id,
            definition_id: action.modifierId,
            multiplier: Number(modDef.multiplier),
            active: true
          } : null;
          return {
            ...currentState,
            activeSaleModifiers: newActive ? [...currentState.activeSaleModifiers, newActive] : currentState.activeSaleModifiers
          };
        }

        case 'MANUAL_REFRESH_SHOP': {
          return {
            ...currentState,
            save: currentState.save ? { ...currentState.save, balance: Number(currentState.save.balance) - action.cost } : null
          };
        }

        case 'UPGRADE_SHOP': {
          return {
            ...currentState,
            save: currentState.save ? { ...currentState.save, balance: Number(currentState.save.balance) - action.cost } : null,
            shopStates: currentState.shopStates.map(s =>
              s.shop_type === action.shopType
                ? {
                    ...s,
                    luck_level: action.upgradeType === 'luck' ? Number(s.luck_level ?? 0) + 1 : Number(s.luck_level ?? 0),
                    refresh_speed_level: action.upgradeType === 'speed' ? Number(s.refresh_speed_level ?? 0) + 1 : Number(s.refresh_speed_level ?? 0)
                  }
                : s
            )
          };
        }

        default:
          return currentState;
      }
    }
  );

  // Helper upgrade math formulas
  const getStageMultiplier = (stage: number) => {
    const s = Math.max(1, stage);
    if (s === 1) return 1;
    if (s === 2) return 5;
    if (s === 3) return 25;
    if (s === 4) return 150;
    if (s === 5) return 1000;
    return 10000;
  };

  const getManualRefreshCost = (shopType: string, stage: number, luckLevel: number) => {
    const base = shopType === 'meat' ? 50 : shopType === 'seasoning' ? 100 : 0;
    return Number((base * getStageMultiplier(stage) * (1 + Math.max(0, luckLevel) * 0.15)).toFixed(2));
  };

  const getRefreshSpeedUpgradeCost = (shopType: string, stage: number, currentLevel: number) => {
    const base = shopType === 'meat' ? 1000 : shopType === 'seasoning' ? 2000 : 0;
    const val = base * Math.pow(Math.max(0, currentLevel) + 1, 2) * Math.pow(1.65, Math.max(0, currentLevel)) * getStageMultiplier(stage);
    return Number(val.toFixed(2));
  };

  const getLuckUpgradeCost = (shopType: string, stage: number, currentLevel: number) => {
    const base = shopType === 'meat' ? 5000 : shopType === 'seasoning' ? 7500 : 0;
    const val = base * Math.pow(Math.max(0, currentLevel) + 1, 2.4) * Math.pow(1.85, Math.max(0, currentLevel)) * getStageMultiplier(stage);
    return Number(val.toFixed(2));
  };

  const getSeasoningSellRefund = (purchasePrice: number, remainingUses: number, maximumUses: number) => {
    return Number((purchasePrice * 0.50 * (remainingUses / maximumUses)).toFixed(2));
  };

  // Centralized action runner with localized loaders and rollback feedback
  async function runAction(
    actionId: string,
    optimisticPayload: DashboardAction | null,
    promise: Promise<{ ok: boolean; message?: string }>,
    successMessage: string,
    errorMessagePrefix: string
  ) {
    startAction(actionId);
    if (optimisticPayload) {
      startTransition(() => {
        setOptimisticState(optimisticPayload);
      });
    }
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
    const interval = setInterval(async () => {
      await resolveTimeProgress();
      router.refresh();
    }, 15000);

    return () => clearInterval(interval);
  }, [router]);

  const meatById = useMemo(
    () => new Map(optimisticState.meats.map((item) => [String(item.id), item])),
    [optimisticState.meats]
  );
  const equipmentById = useMemo(
    () => new Map(optimisticState.equipment.map((item) => [String(item.id), item])),
    [optimisticState.equipment]
  );
  const seasoningById = useMemo(
    () => new Map(optimisticState.seasonings.map((item) => [String(item.id), item])),
    [optimisticState.seasonings]
  );
  const shopStateByType = useMemo(
    () => new Map(optimisticState.shopStates.map((item) => [String(item.shop_type), item])),
    [optimisticState.shopStates]
  );
  const activeModifierIds = useMemo(
    () => new Set(optimisticState.activeSaleModifiers.map((item) => String(item.definition_id))),
    [optimisticState.activeSaleModifiers]
  );
  const activeEquipmentCandidates = useMemo(() => {
    const occupiedByEquipment = new Map<string, number>();
    optimisticState.cookingJobs.forEach((job) => {
      const equipmentId = String(job.equipment_item_id ?? '');
      occupiedByEquipment.set(equipmentId, (occupiedByEquipment.get(equipmentId) ?? 0) + 1);
    });

    return optimisticState.ownedEquipment
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
  }, [optimisticState.cookingJobs, optimisticState.ownedEquipment]);

  if (!mounted) {
    return null;
  }

  const targetOptions = [
    { value: 'cooked', label: 'Cooked' },
    { value: 'well_cooked', label: 'Well Cooked' },
    { value: 'perfectly_cooked', label: 'Perfectly Cooked' }
  ];
  const rawMeats = optimisticState.ownedMeats.filter((item) => textValue(item.current_cooking_state) === 'raw');
  const readyMeats = optimisticState.ownedMeats.filter((item) => isSaleableCookedState(item.current_cooking_state));
  const heldMeats = optimisticState.ownedMeats.filter((item) => {
    const state = textValue(item.current_cooking_state);
    return state !== 'raw' && !SALEABLE_COOKED_STATES.has(state);
  });
  const hasAnySeasonings = optimisticState.ownedSeasonings.some(s => Number(s.remaining_uses ?? 0) > 0);

  function shopControls(shopType: 'meat' | 'seasoning') {
    const state = shopStateByType.get(shopType);
    const label = shopType === 'meat' ? 'Meat' : 'Seasoning';

    const isRefreshing = activeActionIds.has(`refresh-${shopType}`);
    const isSpeedUpgrading = activeActionIds.has(`speed-${shopType}`);
    const isLuckUpgrading = activeActionIds.has(`luck-${shopType}`);

    const refreshCost = getManualRefreshCost(shopType, Number(state?.shop_stage ?? 1), Number(state?.luck_level ?? 0));
    const speedCost = getRefreshSpeedUpgradeCost(shopType, Number(state?.shop_stage ?? 1), Number(state?.refresh_speed_level ?? 0));
    const luckCost = getLuckUpgradeCost(shopType, Number(state?.shop_stage ?? 1), Number(state?.luck_level ?? 0));

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
            style={{ minWidth: isRefreshing ? 100 : 70 }}
            icon={<Icon icon="lucide:refresh-cw" width="15" height="15" />}
            onClick={() =>
              runAction(
                `refresh-${shopType}`,
                { type: 'MANUAL_REFRESH_SHOP', shopType, cost: refreshCost },
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
            style={{ minWidth: isSpeedUpgrading ? 100 : 65 }}
            icon={<Icon icon="lucide:timer" width="15" height="15" />}
            onClick={() =>
              runAction(
                `speed-${shopType}`,
                { type: 'UPGRADE_SHOP', shopType, upgradeType: 'speed', cost: speedCost },
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
            style={{ minWidth: isLuckUpgrading ? 100 : 60 }}
            icon={<Icon icon="lucide:sparkles" width="15" height="15" />}
            onClick={() =>
              runAction(
                `luck-${shopType}`,
                { type: 'UPGRADE_SHOP', shopType, upgradeType: 'luck', cost: luckCost },
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
          style={{
            backgroundColor: '#e2e8f0',
            color: '#475569',
            borderColor: '#cbd5e1',
            fontWeight: 500,
            whiteSpace: 'nowrap'
          }}
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
          style={{
            backgroundColor: '#f8d7da',
            color: '#721c24',
            borderColor: '#f5c6cb',
            fontWeight: 500,
            whiteSpace: 'nowrap'
          }}
        >
          Out of stock
        </Tag>
      );
    }

    if (current <= 2) {
      return (
        <Tag
          style={{
            backgroundColor: '#fff3cd',
            color: '#856404',
            borderColor: '#ffeeba',
            fontWeight: 500,
            whiteSpace: 'nowrap'
          }}
        >
          {current} / {maximum} (Low)
        </Tag>
      );
    }

    return (
      <Tag
        style={{
          backgroundColor: '#d4edda',
          color: '#155724',
          borderColor: '#c3e6cb',
          fontWeight: 500,
          whiteSpace: 'nowrap'
        }}
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
      width: 130,
      render: (_, row) => renderStockBadge(row)
    },
    {
      title: '',
      width: 120,
      render: (_, row) => {
        const isStarter = Boolean(row.starter_only);
        const hasStock = isStarter || Number(row.current_stock ?? 0) > 0;
        const itemId = String(row.item_id ?? row.id);
        const isBuying = activeActionIds.has(`buy-meat-${itemId}`);
        const price = Number(row.purchase_price ?? 0);
        const rawName = row.display_name ?? meatById.get(itemId)?.display_name ?? itemId;
        const displayName = formatMeatName(textValue(rawName, 'Meat'));
        return (
          <div className="table-actions">
            {hasStock ? (
              <Button
                size="small"
                type="primary"
                loading={isBuying}
                disabled={activeActionIds.size > 0}
                style={{ minWidth: isBuying ? 95 : 60 }}
                onClick={() =>
                  runAction(
                    `buy-meat-${itemId}`,
                    { type: 'BUY_MEAT', price, meatItemId: itemId, displayName, tempId: `temp-meat-${Date.now()}` },
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
      width: 120,
      render: (_, row) => {
        const itemId = String(row.id);
        const isBuying = activeActionIds.has(`buy-equipment-${itemId}`);
        const price = Number(row.purchase_price ?? 0);
        const displayName = textValue(row.display_name, 'Equipment');
        const eqType = textValue(row.equipment_type, 'oven');
        const slotCount = Number(row.cooking_slot_count ?? 1);
        const mult = Number(row.price_multiplier ?? 1);
        const cookingSpeedMultiplier = Number(row.cooking_speed_multiplier ?? 1);


        return (
          <div className="table-actions">
            <Button
              size="small"
              loading={isBuying}
              disabled={activeActionIds.size > 0}
              style={{ minWidth: isBuying ? 95 : 60 }}
              onClick={() =>
                runAction(
                  `buy-equipment-${itemId}`,
                  { type: 'BUY_EQUIPMENT', price, equipmentId: itemId, displayName, equipmentType: eqType, cookingSlotCount: slotCount, priceMultiplier: mult, cookingSpeedMultiplier },
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
      width: 130,
      render: (_, row) => renderStockBadge(row)
    },
    {
      title: '',
      width: 120,
      render: (_, row) => {
        const hasStock = Number(row.current_stock ?? 0) > 0;
        const itemId = String(row.item_id ?? row.id);
        const isBuying = activeActionIds.has(`buy-seasoning-${itemId}`);
        const price = Number(row.purchase_price ?? 0);
        const displayName = textValue(row.display_name, 'Seasoning');
        const seasoningDef = seasoningById.get(itemId);
        const maxUses = Number(seasoningDef?.maximum_uses ?? row.maximum_uses ?? 5);
        const baseMult = Number(seasoningDef?.base_multiplier ?? row.base_multiplier ?? 1);
        return (
          <div className="table-actions">
            {hasStock ? (
              <Button
                size="small"
                loading={isBuying}
                disabled={activeActionIds.size > 0}
                style={{ minWidth: isBuying ? 95 : 60 }}
                onClick={() =>
                  runAction(
                    `buy-seasoning-${itemId}`,
                    { type: 'BUY_SEASONING', price, seasoningItemId: itemId, displayName, tempId: `temp-seasoning-${Date.now()}`, maximumUses: maxUses, baseMultiplier: baseMult },
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
        width: 120,
        render: (_, row) => {
          if (row['display_name_override']) {
            return formatMeatName(String(row['display_name_override']));
          }
          return formatMeatName(textValue(relation(row, 'meat_items')?.display_name, textValue(row.meat_item_id)));
        }
      },
      {
        title: 'Weight',
        dataIndex: 'spawned_weight',
        align: 'right',
        width: 80,
        render: formatWeightKg
      },
      {
        title: 'State',
        dataIndex: 'current_cooking_state',
        width: 110,
        render: (value) => <Tag>{formatState(value)}</Tag>
      },
      {
        title: 'Spoils',
        dataIndex: 'spoilage_due_at',
        width: 160,
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
        width: 80,
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
          const availableSeasonings = optimisticState.ownedSeasonings.filter(
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
                row={row}
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
              <Flex className={`table-actions ${hasSeasonings ? 'table-actions-ready-season' : 'table-actions-ready-sell'}`} gap={8} justify="end">
                {hasSeasonings && (
                  <>
                    <Select
                      size="small"
                      aria-label="Seasoning selection"
                      value={selectedSeasoning || undefined}
                      placeholder="Seasoning"
                      options={seasoningOptionsForMeat}
                      onChange={(value) => setSeasoningByMeat((current) => ({ ...current, [rowId]: value }))}
                      style={{ width: 160 }}
                    />
                    <Button
                      size="small"
                      disabled={!selectedSeasoning || activeActionIds.size > 0}
                      loading={isSeasoning}
                      style={{ minWidth: isSeasoning ? 100 : 60 }}
                      onClick={() =>
                        runAction(
                          `season-meat-${rowId}`,
                          { type: 'APPLY_SEASONING', meatInstanceId: rowId, seasoningInstanceId: selectedSeasoning },
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
                  style={{ minWidth: isSelling ? 85 : 60 }}
                  onClick={() => {
                    const meatItem = relation(row, 'meat_items') ?? meatById.get(String(row.meat_item_id));
                    const baseMeatVal = Number(meatItem?.base_meat_value ?? row.base_meat_value_snapshot ?? 0);
                    const spawnedW = Number(row.spawned_weight ?? 0);
                    const purchasePaid = Number(row.purchase_price_paid ?? 0);
                    const cookState = String(row.current_cooking_state ?? 'raw');
                    const eqId = String(row.selected_equipment_item_id ?? '');
                    const eqItem = equipmentById.get(eqId);
                    const eqMult = effectiveEquipmentMultiplierForMeat(meatItem, eqItem);

                    const saleEstimate = calculateSaleValue({
                      cookingState: cookState,
                      spawnedWeight: spawnedW,
                      baseMeatValue: baseMeatVal,
                      purchasePricePaid: purchasePaid,
                      categoryMultiplier: Number(meatItem?.category_multiplier ?? 1),
                      equipmentMultiplier: eqMult,
                      longCookMultiplier: Number(row.long_cook_multiplier_snapshot ?? 1),
                      seasonings: (row['applied_seasonings'] as { baseMultiplier: number; remainingUses: number; maximumUses: number }[]) ?? []
                    });
                    const estPrice = Number(saleEstimate.finalSellingPrice);

                    runAction(
                      `sell-meat-${rowId}`,
                      { type: 'SELL_MEAT', meatInstanceId: rowId, estimatedPrice: estPrice },
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
            <Flex className="table-actions table-actions-held" gap={8} justify="end">
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
            style={{ minWidth: isSyncing ? 85 : 60 }}
            icon={<Icon icon="lucide:refresh-cw" width="16" height="16" />}
            onClick={() =>
              runAction(
                'sync-time',
                null,
                resolveTimeProgress(),
                'Time progress resolved',
                'Failed to Sync Time'
              )
            }
          >
            {isSyncing ? 'Syncing...' : 'Sync time'}
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
          <Statistic title="Balance" value={money(optimisticState.save?.balance)} />
        </Card>
        <Card>
          <Statistic title="Unsold meat" value={optimisticState.ownedMeats.length} />
        </Card>
        <Card>
          <Statistic title="Active cooking jobs" value={optimisticState.cookingJobs.length} />
        </Card>
        <Card>
          <Statistic title="Best sale" value={money(optimisticState.stats?.best_sale_value)} />
        </Card>
      </div>

      {optimisticState.user.isAnonymous && (
        <Alert
          style={{ marginBottom: 16 }}
          type="info"
          showIcon
          message="Guest save active"
          description="Create or sign in to an account to keep this save across devices. Existing accounts are not merged or overwritten."
        />
      )}

      {optimisticState.saleModifierDefinitions.length > 0 && (
        <div className="modifier-strip">
          <Space wrap>
            <Text strong>Sale modifiers</Text>
            {optimisticState.saleModifierDefinitions.map((modifier) => {
              const modifierId = String(modifier.id);
              const isActive = activeModifierIds.has(modifierId);
              const isClaiming = activeActionIds.has(`claim-modifier-${modifierId}`);

              return (
                <Button
                  key={modifierId}
                  size="small"
                  disabled={isActive || activeActionIds.size > 0}
                  loading={isClaiming}
                  style={{ minWidth: isClaiming ? 95 : 60 }}
                  icon={<Icon icon={isActive ? 'lucide:badge-check' : 'lucide:badge-plus'} width="15" height="15" />}
                  onClick={() =>
                    runAction(
                      `claim-modifier-${modifierId}`,
                      { type: 'CLAIM_MODIFIER', modifierId },
                      claimSaleModifier(modifierId),
                      'Sale modifier claimed',
                      'Failed to Claim Sale Modifier'
                    )
                  }
                >
                  {isClaiming ? 'Claiming...' : `${textValue(modifier.display_name, modifierId)} ${numberValue(Number(modifier.multiplier) * 100, 0)}%`}
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
                      columns={getMeatColumns('raw')}
                      dataSource={rawMeats}
                      pagination={{ pageSize: 6, showSizeChanger: false }}
                      scroll={{ x: 940 }}
                    />
                  </Card>
                  {heldMeats.length > 0 && (
                    <Card title="Needs attention">
                      <Table
                        rowKey="id"
                        size="small"
                        columns={getMeatColumns('held')}
                        dataSource={heldMeats}
                        pagination={{ pageSize: 4, showSizeChanger: false }}
                        scroll={{ x: 630 }}
                      />
                    </Card>
                  )}
                </Flex>
                <Flex className="meat-flow" vertical gap={16}>
                  <Card title="Active cooking">
                    {optimisticState.cookingJobs.length ? (
                      <Table<Row>
                        rowKey="id"
                        size="small"
                        dataSource={optimisticState.cookingJobs}
                        pagination={false}
                        scroll={{ x: 650 }}
                        columns={[
                          {
                            title: 'Meat',
                            render: (_, row) => {
                              const displayName = relation(relation(row, 'meat_instances') ?? {}, 'meat_items')?.display_name;
                              if (displayName) {
                                return formatMeatName(String(displayName));
                              }
                              const instance = optimisticState.ownedMeats.find(m => String(m.id) === String(row.meat_instance_id));
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
                                <div style={{ width: '100%', minWidth: '220px' }}>
                                  <Progress
                                    percent={Math.round(percent)}
                                    size="small"
                                    status={percent >= 100 ? 'success' : 'active'}
                                    style={{ marginBottom: '4px' }}
                                  />
                                  <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
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
                    title="Ready to sell"
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
                              style={{ minWidth: isSellingAll ? 85 : 60 }}
                              icon={<Icon icon="lucide:badge-dollar-sign" width="15" height="15" />}
                              onClick={() => {
                                let totalPrice = 0;
                                readyMeats.forEach(row => {
                                  const meatItem = relation(row, 'meat_items') ?? meatById.get(String(row.meat_item_id));
                                  const baseMeatVal = Number(meatItem?.base_meat_value ?? row.base_meat_value_snapshot ?? 0);
                                  const spawnedW = Number(row.spawned_weight ?? 0);
                                  const purchasePaid = Number(row.purchase_price_paid ?? 0);
                                  const cookState = String(row.current_cooking_state ?? 'raw');
                                  const eqId = String(row.selected_equipment_item_id ?? '');
                                  const eqItem = equipmentById.get(eqId);
                                  const eqMult = effectiveEquipmentMultiplierForMeat(meatItem, eqItem);

                                  const saleEstimate = calculateSaleValue({
                                    cookingState: cookState,
                                    spawnedWeight: spawnedW,
                                    baseMeatValue: baseMeatVal,
                                    purchasePricePaid: purchasePaid,
                                    categoryMultiplier: Number(meatItem?.category_multiplier ?? 1),
                                    equipmentMultiplier: eqMult,
                                    longCookMultiplier: Number(row.long_cook_multiplier_snapshot ?? 1),
                                    seasonings: (row['applied_seasonings'] as { baseMultiplier: number; remainingUses: number; maximumUses: number }[]) ?? []
                                  });
                                  totalPrice += Number(saleEstimate.finalSellingPrice);
                                });

                                runAction(
                                  'sell-all-meat',
                                  { type: 'SELL_ALL_MEAT', totalPrice },
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
                              style={{
                                minWidth: isSeasoningAll ? 100 : 75,
                                backgroundColor: '#9a6518',
                                borderColor: '#9a6518',
                                color: '#fff'
                              }}
                              loading={isSeasoningAll}
                              disabled={readyMeats.length === 0 || optimisticState.ownedSeasonings.length === 0 || activeActionIds.size > 0}
                              icon={<Icon icon="lucide:sparkles" width="15" height="15" />}
                              onClick={() => {
                                runAction(
                                  'season-all-meat',
                                  { type: 'SEASON_ALL_MEAT' },
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
                      scroll={{ x: hasAnySeasonings ? 890 : 630 }}
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
                      ...optimisticState.meats.filter((item) => item.starter_only),
                      ...optimisticState.meatStock
                    ]}
                    pagination={{ pageSize: 12, showSizeChanger: false }}
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
                    dataSource={optimisticState.seasoningStock}
                    pagination={{ pageSize: 10, showSizeChanger: false }}
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
                  dataSource={optimisticState.equipment}
                  pagination={{ pageSize: 12, showSizeChanger: false }}
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
                    dataSource={optimisticState.ownedEquipment}
                    pagination={false}
                    scroll={{ x: 600 }}
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
                        width: 120,
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
                                style={{ minWidth: isDestroying ? 95 : 60 }}
                                onClick={() =>
                                  runAction(
                                    `destroy-equipment-${eqId}`,
                                    { type: 'DESTROY_EQUIPMENT', equipmentId: eqId },
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
                <Card title="Owned seasonings">
                  <Table<Row>
                    rowKey="id"
                    size="small"
                    dataSource={optimisticState.ownedSeasonings}
                    pagination={{ pageSize: 8, showSizeChanger: false }}
                    scroll={{ x: 600 }}
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
                        width: 120,
                        render: (_, row) => {
                          const seasoningInstId = String(row.id);
                          const isSellingSeasoning = activeActionIds.has(`sell-seasoning-${seasoningInstId}`);
                          const sItem = relation(row, 'seasoning_items');
                          const refund = getSeasoningSellRefund(
                            Number(sItem?.purchase_price ?? 0),
                            Number(row.remaining_uses ?? 0),
                            Number(row.maximum_uses ?? 5)
                          );
                          return (
                            <div className="table-actions">
                              <Button
                                size="small"
                                loading={isSellingSeasoning}
                                disabled={activeActionIds.size > 0}
                                style={{ minWidth: isSellingSeasoning ? 85 : 60 }}
                                onClick={() =>
                                  runAction(
                                    `sell-seasoning-${seasoningInstId}`,
                                    { type: 'SELL_SEASONING', seasoningInstanceId: seasoningInstId, estimatedRefund: refund },
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
