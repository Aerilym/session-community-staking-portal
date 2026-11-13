import {
  ActionModuleAccordionRow,
  ActionModuleRow,
  ActionModuleSectionHeader,
} from '@/components/ActionModule';
import { URL } from '@/lib/constants';
import { formatDate, formatDurationFromDays } from '@/lib/locale-client';
import { summarizeNodeHistory } from '@/lib/node-history';
import type { NodeHistoryResponse } from '@/lib/node-history-schema';
import { LinkOutIcon } from '@session/ui/icons/LinkOutIcon';
import { TriangleAlertIcon } from '@session/ui/icons/TriangleAlertIcon';
import { cn } from '@session/ui/lib/utils';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';

export function NodeHistorySection({
  history,
  pubKey,
}: {
  history: NodeHistoryResponse;
  pubKey: string;
}) {
  const dictShared = useTranslations('actionModules.shared');
  const dict = useTranslations('actionModules.nodeHistory');
  const summary = useMemo(() => summarizeNodeHistory(history.generations), [history.generations]);

  const generationLine = (generation: NodeHistoryResponse['generations'][number]) => {
    const start = formatDate(new Date(generation.registration_timestamp * 1000), {
      dateStyle: 'medium',
    });
    const end = generation.end_timestamp
      ? formatDate(new Date(generation.end_timestamp * 1000), {
          dateStyle: 'medium',
        })
      : null;
    const duration =
      generation.duration_days !== null ? formatDurationFromDays(generation.duration_days) : null;

    return (
      <div
        className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 py-1 text-sm"
        key={generation.contract_id}
      >
        <span className="font-mono text-muted-foreground">#{generation.contract_id}</span>
        <span className="font-semibold">
          {start}
          {end ? ` to ${end}` : ''}
        </span>
        {duration ? <span className="text-muted-foreground">({duration})</span> : null}
        {generation.end_label ? (
          <span
            className={cn(
              'font-semibold',
              generation.end_label === 'Liquidated'
                ? 'text-indicator-red'
                : generation.end_label === 'Deregistered'
                  ? 'text-warning'
                  : 'text-session-green'
            )}
          >
            {generation.end_label}
          </span>
        ) : null}
        {generation.decommission_count > 0 ? (
          <span className="text-muted-foreground">
            {dict('decommissions', { count: generation.decommission_count })}
          </span>
        ) : null}
      </div>
    );
  };

  return (
    <>
      <ActionModuleSectionHeader>{dictShared('sectionNodeHistory')}</ActionModuleSectionHeader>
      {summary.keyCurrentlyActive ? (
        <ActionModuleRow label={dict('keyActive')} tooltip={dict('keyActiveDescription')}>
          <span className="inline-flex items-center gap-2 font-semibold text-indicator-red">
            <TriangleAlertIcon className="h-4 w-4 stroke-indicator-red" />
            {dict('keyActiveWarning')}
          </span>
        </ActionModuleRow>
      ) : null}
      {history.n_generations === 0 ? (
        <ActionModuleRow
          label={dict('firstGeneration')}
          tooltip={dict('firstGenerationDescription')}
          last
        >
          <span className="font-semibold">{dict('noPreviousGenerations')}</span>
        </ActionModuleRow>
      ) : (
        <>
          <ActionModuleAccordionRow
            label={dict('previousGenerations')}
            tooltip={dict('previousGenerationsDescription')}
            accordionContent={
              <div className="flex w-full flex-col divide-y divide-gray-dark">
                {history.generations.map(generationLine)}
              </div>
            }
          >
            <span className="font-semibold">
              {dict('generationCount', { count: history.generations.length })}
            </span>
          </ActionModuleAccordionRow>
          <ActionModuleRow label={dict('totalUptime')} tooltip={dict('totalUptimeDescription')}>
            <span className="font-semibold">{formatDurationFromDays(summary.totalUptimeDays)}</span>
          </ActionModuleRow>
          <ActionModuleRow label={dict('exitOutcomes')} tooltip={dict('exitOutcomesDescription')}>
            <span
              className={cn(
                'font-semibold',
                summary.liquidations > 0 || summary.deregistrations > 0
                  ? 'text-indicator-red'
                  : 'text-session-green'
              )}
            >
              {[
                summary.normalExits > 0
                  ? dict('outcomeExits', { count: summary.normalExits })
                  : null,
                summary.liquidations > 0
                  ? dict('outcomeLiquidations', { count: summary.liquidations })
                  : null,
                summary.deregistrations > 0
                  ? dict('outcomeDeregistrations', { count: summary.deregistrations })
                  : null,
              ]
                .filter(Boolean)
                .join(' · ') || dict('noPreviousGenerations')}
            </span>
          </ActionModuleRow>
          <ActionModuleRow
            label={dict('fullHistory')}
            tooltip={dict('fullHistoryDescription')}
            last
          >
            <a
              href={`${URL.SESH_TOKEN_EXPLORER}/node/${pubKey}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 align-middle text-session-green text-sm underline underline-offset-2"
            >
              {dict('viewHistoryLink')}
              <LinkOutIcon className="h-4 w-4" />
            </a>
          </ActionModuleRow>
        </>
      )}
      <div className="h-2" />
    </>
  );
}
