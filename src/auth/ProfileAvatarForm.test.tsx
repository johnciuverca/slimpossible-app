import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const auth = vi.hoisted(() => ({
  chooseProfileAvatar: vi.fn(),
  clearProfileAvatar: vi.fn(),
  getProfileAvatar: vi.fn(),
  saveProfileAvatar: vi.fn(),
}))

vi.mock('./useAuth', () => ({ useAuth: () => auth }))

import { ProfileAvatarForm } from './ProfileAvatarForm'

const originalShowModal = HTMLDialogElement.prototype.showModal
const originalClose = HTMLDialogElement.prototype.close

describe('ProfileAvatarForm', () => {
  beforeEach(() => {
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        this.setAttribute('open', '')
      },
    })
    Object.defineProperty(HTMLDialogElement.prototype, 'close', {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        this.removeAttribute('open')
      },
    })
    auth.chooseProfileAvatar.mockReset().mockResolvedValue(true)
    auth.clearProfileAvatar.mockReset().mockResolvedValue(true)
    auth.getProfileAvatar.mockReset().mockResolvedValue({
      avatarPath: null,
      presetId: null,
    })
    auth.saveProfileAvatar.mockReset().mockResolvedValue(true)
  })

  afterEach(() => {
    cleanup()
    if (originalShowModal)
      Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
        configurable: true,
        value: originalShowModal,
      })
    else Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal')
    if (originalClose)
      Object.defineProperty(HTMLDialogElement.prototype, 'close', {
        configurable: true,
        value: originalClose,
      })
    else Reflect.deleteProperty(HTMLDialogElement.prototype, 'close')
  })

  function renderInsideProfile() {
    return render(
      <dialog
        open
        aria-label="Profile"
        onCancel={(event) => {
          if (event.target !== event.currentTarget) return
          event.preventDefault()
          event.currentTarget.close()
        }}
      >
        <ProfileAvatarForm
          onDirtyChange={() => undefined}
          onSavingChange={() => undefined}
        />
      </dialog>,
    )
  }

  it('keeps Profile open when the avatar picker or file chooser is canceled', async () => {
    renderInsideProfile()
    const profileDialog = screen.getByRole('dialog', { name: 'Profile' })
    fireEvent.click(
      screen.getByRole('button', { name: 'Change profile picture' }),
    )

    const picker = screen.getByRole('dialog', {
      name: 'Choose a profile picture',
    })
    expect(picker).toHaveAttribute('open')
    const fileInput = screen.getByLabelText('Upload profile picture')
    fireEvent(
      fileInput,
      new Event('cancel', { bubbles: true, cancelable: true }),
    )
    expect(picker).toHaveAttribute('open')

    fireEvent(picker, new Event('cancel', { cancelable: true }))
    await waitFor(() => expect(picker).not.toHaveAttribute('open'))
    expect(profileDialog).toHaveAttribute('open')
  })

  it('shows a recoverable message when the selected avatar cannot be loaded', async () => {
    auth.getProfileAvatar.mockRejectedValue(
      new Error('We could not load your profile picture. Try again.'),
    )
    renderInsideProfile()
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We could not load your profile picture. Try again.',
    )
    expect(screen.getByLabelText('Default profile picture')).toBeInTheDocument()
  })

  it('keeps the Profile view compact and opens both avatar sets in the nested picker', () => {
    renderInsideProfile()
    expect(screen.getByLabelText('Default profile picture')).toBeInTheDocument()
    expect(screen.queryByRole('tablist', { name: 'Avatar set' })).toBeNull()
    fireEvent.click(
      screen.getByRole('button', { name: 'Change profile picture' }),
    )
    expect(screen.getByRole('tab', { name: 'Male' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: 'Female' }))
    expect(
      screen.getByRole('tabpanel', { name: 'Female avatars' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Choose female avatar 15' }),
    ).toBeInTheDocument()
  })
})
