# Accessibility and fallbacks

Essential calculations have labeled native numeric inputs/sliders, prediction radio groups, text interpretations, and optional data tables. No assessment requires camera rotation, color discrimination, sound, or pointer dragging. Basis labels, solid versus dashed geometry, numeric coordinates, and original/transformed labels supplement color.

- Tab/Shift+Tab moves through controls. Arrow keys edit numeric inputs/sliders. Radio groups use native keyboard behavior. Visible focus outlines, a skip link, main focus on navigation, labeled navigation, fieldsets, table captions, and status feedback are provided.
- 3D drag capture disables orbit until release/cancel. A basis endpoint moves in a fixed mathematical xy plane at its current z. Numeric matrix inputs expose all dimensions.
- `2D view` switches to SVG. WebGL2 absence and context loss automatically preserve parameters and assessment in SVG/numeric mode. The 3D-view button can retry after context loss. A rendering boundary also provides SVG on a renderer failure.
- No automatic animation, camera drift, sound, flashing, or autoplay descent. Rendering is on demand; pixel ratio is capped at 1.5. Reduced-motion CSS disables transitions and transforms that animate.
- Small screens retain a prominent scene and place controls immediately after it. Navigation is a collapsible menu; it is removed from focus when closed. Native range controls are touch-capable; matrix cells and main actions are at least 44 pixels high. Some desktop scene utility buttons and secondary chips are smaller and spaced apart.
- Midnight/daylight/system appearance and four explanation depths are preferences. Fonts and KaTeX MathML are bundled locally.

Automated axe scans cover essential paths in both themes. Browser simulation does not replace VoiceOver/NVDA use, real touchscreen orbit/pinch tests, physical low-end mobile measurements, or human usability review. See TEST_REPORT for executed and unexecuted evidence. These limitations prevent an unqualified production/accessibility certification claim.
