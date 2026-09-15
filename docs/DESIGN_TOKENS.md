# Unsaid — Design tokens (MVP)

**Intentional lock for build.** Slightly adjusted from the earliest product memo for WCAG contrast on ivory while keeping the same feel: private, calm, premium, not bridal-generic, not dating-app.

## Color

| Role | Token | Hex |
| --- | --- | --- |
| Background | `--color-ivory` | `#FAF7F2` |
| Text | `--color-ink` | `#181416` |
| Brand | `--color-wine` | `#54263A` |
| Brand hover | `--color-wine-dark` | `#3F1C2C` |
| Accent | `--color-rose` | `#B8667A` |
| Surface | `--color-stone` | `#EEE9E4` |
| Aligned | `--color-sage` | `#6E806F` |
| Conversation | `--color-ochre` | `#B47A32` |
| Major | `--color-brick` | `#A34D46` |
| Border | `--color-warm-gray` | `#DDD6D0` |
| White | `--color-white` | `#FFFFFF` |

No traffic-light red/green. Severity always has a text label (“Major conversation”), not color alone.

## Typography

| Role | Family | Weights |
| --- | --- | --- |
| Display | **Newsreader** (`next/font/google`) | 500, 600, 700 |
| UI / body | **Inter** | 400, 500, 600, 700 |

Mobile scale: hero 48/50 · H1 36/40 · H2 28/34 · H3 22/28 · body large 18/28 · body 16/24 · small 14/20. Min UI 14px.

## Layout / controls

- Content max 640px; results desktop 960px  
- Padding 20 → 24 → 32  
- Buttons 52px height, radius 14px  
- Cards radius 18px; prefer border over heavy shadow  

## Motion

Hero fade-rise; answer press; results unlock. Honor `prefers-reduced-motion`.
