'use client';

import { NavLink, type NavLinkProps } from '@/components/NavLink';
import { DYNAMIC_LINKS, EXTERNAL_ROUTES, SSR_LINKS } from '@/lib/constants';
import { ButtonDataTestId } from '@/testing/data-test-ids';
import { HamburgerIcon } from '@session/ui/icons/HamburgerIcon';
import { cn } from '@session/ui/lib/utils';
import { Button } from '@session/ui/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@session/ui/ui/dropdown-menu';
import { useTranslations } from 'next-intl';

function DropdownMenuItemNavLink({ label, className, children, ...props }: NavLinkProps) {
  return (
    <NavLink {...props} className={cn(className, 'px-2 py-1')}>
      {children ?? label}
    </NavLink>
  );
}

export function DropdownHamburgerMenu() {
  const dictionary = useTranslations('navigation.hamburgerDropdown');
  const navDictionary = useTranslations('navigation');

  const routes: typeof SSR_LINKS = [];
  for (const { dictionaryKey, href } of [DYNAMIC_LINKS.myStakes, ...SSR_LINKS]) {
    if (
      (dictionaryKey === 'faucet' &&
        !(process.env.NEXT_PUBLIC_ENABLE_FAUCET?.toLowerCase() === 'true')) ||
      (dictionaryKey === 'leaderboard' &&
        !(process.env.NEXT_PUBLIC_ENABLE_LEADERBOARD?.toLowerCase() === 'true'))
    ) {
      continue;
    }
    routes.push({ dictionaryKey, href });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="md"
          data-testid={ButtonDataTestId.Dropdown_Hamburger_Menu}
          className="group p-0"
          aria-label={dictionary('ariaLabel')}
          variant="outline"
        >
          <HamburgerIcon className="m-1.5 h-8 w-8 stroke-session-green group-hover:stroke-session-black" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="flex w-max flex-col">
        {routes.map(({ dictionaryKey, href }) => (
          <DropdownMenuItemNavLink
            key={href}
            href={href}
            label={navDictionary(dictionaryKey)}
            className="md:hidden"
          />
        ))}
        {EXTERNAL_ROUTES.map(({ dictionaryKey, href }) => (
          <DropdownMenuItemNavLink key={href} href={href} label={navDictionary(dictionaryKey)} />
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
