# Pre-upstream v1.21 Admin visual baseline

These screenshots were captured from the unmerged local Admin at
`f067389ac3b1c92b331464130fb7ee6cad25a9ec` using the deterministic Admin mock
API on `127.0.0.1:43123`.

| File | Route | Requested viewport | Captured pixels | Theme | Locale |
| --- | --- | --- | --- | --- | --- |
| `dashboard-light-1440x900.jpg` | `/#/dashboard` | 1440 x 900 | 1425 x 891 | Light | en-US |
| `dashboard-dark-1440x900.jpg` | `/#/dashboard` | 1440 x 900 | 1425 x 891 | Dark | en-US |
| `dashboard-zh-CN-light-1440x900.jpg` | `/#/dashboard` | 1440 x 900 | 1425 x 891 | Light | zh-CN |
| `dashboard-light-390x844.jpg` | `/#/dashboard` | 390 x 844 | 375 x 811 | Light | en-US |
| `servers-light-1440x900.jpg` | `/#/dashboard/servers` | 1440 x 900 | 1440 x 900 | Light | en-US |
| `servers-light-390x844.jpg` | `/#/dashboard/servers` | 390 x 844 | 375 x 811 | Light | en-US |
| `nodes-light-390x844.jpg` | `/#/dashboard/nodes` | 390 x 844 | 375 x 811 | Light | en-US |
| `users-light-1440x900.jpg` | `/#/dashboard/user` | 1440 x 900 | 1440 x 900 | Light | en-US |
| `users-light-390x844.jpg` | `/#/dashboard/user` | 390 x 844 | 390 x 843 | Light | en-US |

The in-app browser can reserve scrollbar or browser-chrome pixels, so the
captured page dimensions may be slightly smaller than the requested viewport.
The baseline protects layout and design continuity. Dynamic timestamps and
motion-frame differences are not pixel-stable and must be compared
semantically rather than as exact image bytes.
