'use client';

import { EXPLORER_LINKS, ExplorerSearch } from '@/components/ExplorerSearch';
import { ModuleOverlayTitle } from '@/components/ModuleOverlayTitle';
import { Module } from '@session/ui/components/Module';
import { LinkOutIcon } from '@session/ui/icons/LinkOutIcon';
import { Button } from '@session/ui/ui/button';
import { useTranslations } from 'next-intl';

export default function ExplorerModule() {
  const dict = useTranslations('modules.explorer');
  const titleFormat = useTranslations('modules.title');

  return (
    <Module size="lg" outerClassName="mt-4">
      <ModuleOverlayTitle longText={titleFormat('format', { title: dict('title') })} />
      <ExplorerSearch />
      <div className="mt-2 grid w-full grid-cols-2 gap-2">
        {EXPLORER_LINKS.map(({ label, href, testId }) => (
          <Button
            key={href}
            asChild
            variant="outline"
            size="sm"
            className="flex w-full items-center justify-between px-4"
            data-testid={testId}
          >
            <a href={href} target="_blank" rel="noreferrer">
              {label}
              <LinkOutIcon className="h-4 w-4" />
            </a>
          </Button>
        ))}
      </div>
    </Module>
  );
}
