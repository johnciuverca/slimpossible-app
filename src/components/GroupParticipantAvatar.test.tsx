import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { GroupParticipantAvatar } from './GroupParticipantAvatar'

describe('GroupParticipantAvatar', () => {
  it('renders the existing built-in avatar sprite for a valid selection', () => {
    const { container } = render(
      <GroupParticipantAvatar
        avatarPresetId="female-03"
        displayName="Ava Member"
      />,
    )

    const avatar = container.querySelector('[data-avatar-preset="female-03"]')
    expect(avatar).toHaveClass('h-9', 'w-9', 'shrink-0', 'rounded-full')
    expect(avatar?.firstElementChild).toHaveStyle({
      backgroundImage: 'url(/avatars/female-challenge-avatars.png)',
    })
    expect(screen.queryByText('A')).not.toBeInTheDocument()
  })

  it('uses a neutral initial when no built-in avatar is selected', () => {
    const { container } = render(
      <GroupParticipantAvatar displayName="nora member" />,
    )

    expect(
      container.querySelector('[data-avatar-preset="default"]'),
    ).toHaveTextContent('N')
  })
})
