'use client';

import { ModuleOverlayTitle } from '@/components/ModuleOverlayTitle';
import { URL } from '@/lib/constants';
import { ButtonDataTestId, InputDataTestId } from '@/testing/data-test-ids';
import { Module } from '@session/ui/components/Module';
import { LinkOutIcon } from '@session/ui/icons/LinkOutIcon';
import { SearchIcon } from '@session/ui/icons/SearchIcon';
import { Button } from '@session/ui/ui/button';
import { Input } from '@session/ui/ui/input';
import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';

const EXPLORER_LINKS = [
  {
    label: 'Operators',
    href: `${URL.SESH_TOKEN_EXPLORER}/operators`,
    testId: ButtonDataTestId.Explorer_Link_Operators,
  },
  {
    label: 'Holders',
    href: `${URL.SESH_TOKEN_EXPLORER}/holders`,
    testId: ButtonDataTestId.Explorer_Link_Holders,
  },
  {
    label: 'Network',
    href: `${URL.SESH_TOKEN_EXPLORER}/network`,
    testId: ButtonDataTestId.Explorer_Link_Network,
  },
  {
    label: 'Tokenomics',
    href: `${URL.SESH_TOKEN_EXPLORER}/tokenomics`,
    testId: ButtonDataTestId.Explorer_Link_Tokenomics,
  },
] as const;

export default function ExplorerModule() {
  const dict = useTranslations('modules.explorer');
  const titleFormat = useTranslations('modules.title');
  const [search, setSearch] = useState('');

  const handleSearch = (event: FormEvent) => {
    event.preventDefault();
    const query = search.trim();
    if (!query) return;
    window.open(`${URL.SESH_TOKEN_EXPLORER}/address/${query}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <Module
      size="lg"
      outerClassName="mt-4"
      className="[&>div:not([class*='absolute'])]:!p-3 md:[&>div:not([class*='absolute'])]:!p-4"
    >
      <ModuleOverlayTitle longText={titleFormat('format', { title: dict('title') })} />
      <form onSubmit={handleSearch} className="flex w-full gap-2">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={dict('searchPlaceholder')}
          data-testid={InputDataTestId.Explorer_Search}
          className="h-9 w-full"
        />
        <Button
          type="submit"
          variant="outline"
          size="sm"
          className="h-9 shrink-0 px-3"
          aria-label={dict('search')}
          data-testid={ButtonDataTestId.Explorer_Search}
        >
          <SearchIcon className="h-4 w-4" />
        </Button>
      </form>
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
