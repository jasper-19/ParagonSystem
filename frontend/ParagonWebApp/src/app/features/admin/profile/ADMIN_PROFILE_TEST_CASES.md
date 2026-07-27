# Admin Profile Responsive Verification

## Viewports and input methods

| ID | Viewport / input | Steps | Expected result |
| --- | --- | --- | --- |
| R-01 | 320 × 568, touch | Open `/admin/profile` and scroll through every section. | No horizontal page scroll. Header actions, cards, fields, session details, and messages remain within the viewport. |
| R-02 | 375 × 812, touch | Upload a valid image, fill all password fields, toggle 2FA, and sign out a non-current session. | Every control has a minimum 44 px target, remains reachable above the virtual keyboard, and gives visible progress feedback. |
| R-03 | 768 × 1024, touch and keyboard | Rotate between portrait and landscape after entering form values. | Content reflows without losing form data. Password fields move cleanly between one- and two-column layouts. |
| R-04 | 1024 × 768, mouse and keyboard | Collapse and expand the admin sidebar. | Profile content resizes without clipping. The password form changes between two and three columns as space permits. |
| R-05 | 1440 × 900, mouse | Review the page at 100%, then browser zoom at 200%. | Content remains centered and readable, long lines stay constrained, and no two-dimensional scrolling is required. |
| R-06 | 2560 × 1440, mouse | Open the page with the sidebar expanded. | The profile shell stops at its maximum width and does not produce excessively long content lines. |

## Loading, empty, and error states

| ID | State | Steps | Expected result |
| --- | --- | --- | --- |
| S-01 | Initial loading | Throttle the profile, college, and sessions requests. | Profile, information, and session skeletons appear. 2FA reports “Checking”. No layout jump causes controls to overlap. |
| S-02 | Profile error | Return 500 from `/auth/me`. | A profile-unavailable alert and working “Try again” action appear. Security settings remain available. |
| S-03 | Stale profile refresh | Load the profile successfully, then fail a manual refresh. | Existing profile data remains visible and a non-blocking status notice explains the refresh failure. |
| S-04 | Empty profile | Return an authenticated user with `staff: null`. | A no-linked-profile explanation and staff-directory action appear instead of blank information fields. |
| S-05 | College lookup error | Fail the college request while returning a staff profile. | Stored college/program identifiers remain visible with a non-blocking retry notice. |
| S-06 | Sessions empty | Return `{ sessions: [] }`. | A clear empty state appears with no stale or disabled session actions. |
| S-07 | Sessions error | Return 401, 500, and timeout responses separately. | The relevant error message and keyboard-accessible retry action appear. |
| S-08 | Session sign-out error | Fail deletion of a non-current session. | The session remains listed and an inline error is announced. The action becomes available again. |

## Forms and behavior

| ID | Scenario | Steps | Expected result |
| --- | --- | --- | --- |
| F-01 | Empty password submit | Focus and blur each password field, then submit. | Required messages appear, invalid fields expose `aria-invalid`, and submission does not call the API. |
| F-02 | Weak password | Enter fewer than eight characters or omit an uppercase, lowercase, number, or special character. | Requirements update as the user types, strength feedback changes, and submit remains disabled. |
| F-03 | Reused password | Enter the same current and new password. | The form explains that the new password must differ and prevents submission. |
| F-04 | Mismatched confirmation | Enter valid but different new and confirmation values. | A mismatch message appears and submit remains disabled. |
| F-05 | Valid password | Enter a valid unique password and submit. | The button reports progress, duplicate submission is prevented, fields reset on success, and other sessions refresh. |
| F-06 | Avatar validation | Select a non-image, an image over 5 MB, then a valid PNG/JPEG/WebP. | Invalid files are rejected and announced. A valid image previews without being represented as saved. |
| F-07 | 2FA rollback | Toggle 2FA and force the update request to fail. | The control is disabled while saving, restores its previous state on failure, and announces the error. |

## Keyboard and assistive technology

| ID | Scenario | Steps | Expected result |
| --- | --- | --- | --- |
| A-01 | Tab order | Navigate the page using `Tab` and `Shift+Tab` only. | Focus follows visual order and every interactive control has a visible focus ring. |
| A-02 | Invalid submit focus | Enter invalid password values and submit. | Validation is announced and focus moves to the first invalid field. |
| A-03 | Password visibility | Activate each visibility button with `Enter` and `Space`. | Only the associated field changes type and `aria-pressed` updates. |
| A-04 | 2FA switch | Focus the switch and press `Space`. | The switch toggles once, becomes disabled while saving, and announces success or rollback failure. |
| A-05 | Session action | Activate “Sign out” with the keyboard. | The stable session ID is used, the button reports progress, and only that session is removed on success. |
| A-06 | Screen reader | Read headings, definition lists, statuses, and errors. | Heading hierarchy is logical, labels and values are associated, and live updates are announced without stealing focus. |

## Motion and content resilience

| ID | Scenario | Steps | Expected result |
| --- | --- | --- | --- |
| C-01 | Reduced motion | Enable `prefers-reduced-motion: reduce` and reload. | Skeleton, spinner, width, transform, and color transitions are removed or effectively static. |
| C-02 | Long content | Use a 70-character name, email, role, section, browser, OS, and device values. | Values wrap within their cards and never overlap controls. |
| C-03 | High contrast | Enable forced/high-contrast mode and keyboard through the page. | Native inputs, switch state, borders, text, and focus remain perceivable. |
| C-04 | Text scaling | Set operating-system text scaling to 200%. | Text remains readable, cards grow vertically, and controls do not clip or overlap. |
| C-05 | Slow network actions | Throttle password, 2FA, refresh, and sign-out requests. | Each initiating control exposes a disabled/progress state and cannot trigger duplicate requests. |
