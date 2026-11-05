'use client';

import { ModuleOverlayTitle } from '@/components/ModuleOverlayTitle';
import { URL } from '@/lib/constants';
import { ButtonDataTestId, InputDataTestId } from '@/testing/data-test-ids';
import { Module } from '@session/ui/components/Module';
import { useDebounce } from '@session/ui/hooks/useDebounce';
import { HashIcon } from '@session/ui/icons/HashIcon';
import { KeyRoundIcon } from '@session/ui/icons/KeyRoundIcon';
import { LinkOutIcon } from '@session/ui/icons/LinkOutIcon';
import { SearchIcon } from '@session/ui/icons/SearchIcon';
import { Spinner } from '@session/ui/icons/Spinner';
import { WalletIcon } from '@session/ui/icons/WalletIcon';
import { Button } from '@session/ui/ui/button';
import { Input } from '@session/ui/ui/input';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { type FormEvent, type KeyboardEvent, useState } from 'react';
import { z } from 'zod';

const searchEntrySchema = z.object({
  kind: z.enum(['address', 'node-ed', 'node-bls', 'node-cid']),
  value: z.string(),
  display: z.string(),
  secondary: z.string().optional(),
  href: z.string(),
  rank: z.number(),
});

const suggestResponseSchema = z.object({ results: z.array(searchEntrySchema) });

type SearchEntry = z.infer<typeof searchEntrySchema>;

const MIN_SEARCH_LENGTH = 2;
const SUGGEST_DEBOUNCE_MS = 200;

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
  {
    label: 'Bridge',
    href: `${URL.SESH_TOKEN_EXPLORER}/bridge`,
    testId: ButtonDataTestId.Explorer_Link_Bridge,
  },
  {
    label: 'Reward Pool',
    href: `${URL.SESH_TOKEN_EXPLORER}/reward-pool`,
    testId: ButtonDataTestId.Explorer_Link_Reward_Pool,
  },
] as const;

function openInExplorer(path: string) {
  window.open(`${URL.SESH_TOKEN_EXPLORER}${path}`, '_blank', 'noopener,noreferrer');
}

function EntryIcon({ kind }: { kind: SearchEntry['kind'] }) {
  const className = 'text-muted-foreground h-4 w-4 shrink-0';
  switch (kind) {
    case 'address':
      return <WalletIcon className={className} />;
    case 'node-cid':
      return <HashIcon className={className} />;
    default:
      return <KeyRoundIcon className={className} />;
  }
}

export default function ExplorerModule() {
  const dict = useTranslations('modules.explorer');
  const titleFormat = useTranslations('modules.title');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const debounced = useDebounce(search, SUGGEST_DEBOUNCE_MS);

  const { data, isFetching } = useQuery({
    queryKey: ['explorerSearchSuggest', debounced],
    enabled: debounced.trim().length >= MIN_SEARCH_LENGTH,
    staleTime: 30_000,
    placeholderData: (previous) => previous,
    queryFn: async () => {
      const res = await fetch(
        `${URL.SESH_TOKEN_EXPLORER}/api/search/suggest?q=${encodeURIComponent(debounced)}`
      );
      if (!res.ok) return { results: [] };
      return suggestResponseSchema.parse(await res.json());
    },
  });

  const results = data?.results ?? [];
  const showDropdown = open && (debounced.trim().length >= MIN_SEARCH_LENGTH || results.length > 0);
  const active = results[activeIndex] ? activeIndex : -1;

  function select(entry: SearchEntry) {
    setOpen(false);
    openInExplorer(entry.href);
  }

  function submitTerm() {
    setOpen(false);
    const trimmed = search.trim();
    if (trimmed) {
      openInExplorer(`/search?q=${encodeURIComponent(trimmed)}`);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      if (results.length) {
        setActiveIndex((index) => ((results[index] ? index : -1) + 1) % results.length);
      }
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (results.length) {
        setActiveIndex((index) => {
          const current = results[index] ? index : -1;
          return current <= 0 ? results.length - 1 : current - 1;
        });
      }
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const entry = results[active];
      if (active >= 0 && entry) {
        select(entry);
      } else {
        submitTerm();
      }
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <Module size="lg" outerClassName="mt-4">
      <ModuleOverlayTitle longText={titleFormat('format', { title: dict('title') })} />
      <div className="relative w-full">
        <form
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            submitTerm();
          }}
          className="flex w-full gap-2"
        >
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onKeyDown={handleKeyDown}
            placeholder={dict('searchPlaceholder')}
            aria-label={dict('search')}
            data-testid={InputDataTestId.Explorer_Search}
            className="h-9 w-full"
            autoComplete="off"
            spellCheck={false}
          />
          <Button
            type="submit"
            variant="outline"
            size="sm"
            className="h-9 shrink-0 px-3"
            aria-label={dict('search')}
            data-testid={ButtonDataTestId.Explorer_Search}
          >
            {isFetching && debounced.trim().length >= MIN_SEARCH_LENGTH ? (
              <Spinner className="h-4 w-4" />
            ) : (
              <SearchIcon className="h-4 w-4" />
            )}
          </Button>
        </form>
        {showDropdown ? (
          <div className="absolute top-full right-0 left-0 z-50 mt-1 overflow-hidden rounded-md border bg-session-black shadow-md">
            {results.length ? (
              <ul>
                {results.map((entry, index) => (
                  <li key={`${entry.kind}-${entry.value}`}>
                    <button
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => select(entry)}
                      onMouseEnter={() => setActiveIndex(index)}
                      className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm ${
                        index === active ? 'bg-accent' : ''
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <EntryIcon kind={entry.kind} />
                        <span className="truncate font-mono">{entry.display}</span>
                      </span>
                      {entry.secondary ? (
                        <span className="shrink-0 text-muted-foreground text-xs">
                          {entry.secondary}
                        </span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-3 py-2 text-muted-foreground text-sm">{dict('noMatches')}</p>
            )}
          </div>
        ) : null}
      </div>
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
