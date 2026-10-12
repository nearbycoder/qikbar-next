import { baseDark, baseLight, cssVarName } from './themes.js'
import type { ThemeVars } from '../core/types.js'

const vars = (v: ThemeVars) =>
  Object.entries(v)
    .map(([k, val]) => `${cssVarName(k)}:${val};`)
    .join('')

/**
 * Default stylesheet. Every visual decision reads from a `--qb-*` custom
 * property so you can theme Qikbar without touching selectors.
 * The same CSS ships as `@qikbar/qikbar/styles.css` if you prefer a `<link>`.
 */
export const css = /* css */ `
.qb-root{${vars(baseLight)}--qb-z:2147483000;--qb-ease:cubic-bezier(.16,1,.3,1);font-family:var(--qb-font);font-size:var(--qb-font-size);line-height:1.45;color:var(--qb-fg);-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;text-align:start;color-scheme:light}
.qb-root[data-qb-appearance=dark]{${vars(baseDark)}color-scheme:dark}
:where(.qb-root) *,:where(.qb-root) *::before,:where(.qb-root) *::after{box-sizing:border-box}
:where(.qb-root) :where(button,input,textarea,select){font:inherit;color:inherit;margin:0;letter-spacing:inherit}
:where(.qb-root) button{background:none;border:0;padding:0;cursor:pointer;text-transform:none}
:where(.qb-root) svg{display:block;flex-shrink:0}
.qb-root [hidden]{display:none!important}
.qb-sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}

.qb-overlay{position:fixed;inset:0;z-index:var(--qb-z);background:var(--qb-overlay);animation:qb-fade .18s ease-out}
.qb-dialog{position:fixed;z-index:calc(var(--qb-z) + 1);top:var(--qb-top);left:50%;translate:-50% 0;width:min(var(--qb-width),calc(100vw - 24px));display:flex;flex-direction:column;background:var(--qb-bg);border:1px solid var(--qb-border);border-radius:var(--qb-radius);box-shadow:var(--qb-shadow);overflow:hidden;-webkit-backdrop-filter:blur(var(--qb-backdrop-blur)) saturate(1.8);backdrop-filter:blur(var(--qb-backdrop-blur)) saturate(1.8);animation:qb-in .22s var(--qb-ease);transform-origin:50% 0;outline:none}
.qb-root[data-qb-state=closing] .qb-dialog{animation:qb-out .12s ease-in forwards}
.qb-root[data-qb-state=closing] .qb-overlay{animation:qb-fade-out .12s ease-in forwards}
.qb-root[data-qb-inline]{display:block;position:relative}
.qb-root[data-qb-inline] .qb-dialog{position:relative;top:auto;left:auto;translate:none;width:100%;z-index:auto;animation:none}

.qb-header{position:relative;display:flex;align-items:center;gap:10px;height:var(--qb-input-height);padding:0 16px;border-bottom:1px solid var(--qb-border);flex-shrink:0}
.qb-header-icon{color:var(--qb-fg-subtle);display:flex}
.qb-input{flex:1;min-width:0;height:100%;border:0;outline:0;background:transparent;font-size:var(--qb-input-font-size);padding:0;caret-color:var(--qb-accent)}
.qb-input::placeholder{color:var(--qb-fg-subtle);opacity:1}
.qb-input::-webkit-search-cancel-button{display:none}
.qb-back{display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:7px;background:var(--qb-kbd-bg);color:var(--qb-fg-muted);flex-shrink:0;transition:background .1s}
.qb-back:hover{color:var(--qb-fg)}
.qb-crumb{display:flex;align-items:center;gap:6px;max-width:40%;padding:3px 9px 3px 7px;border-radius:7px;background:var(--qb-kbd-bg);color:var(--qb-fg-muted);font-size:12.5px;font-weight:500;white-space:nowrap;flex-shrink:0}
.qb-crumb span:last-child{overflow:hidden;text-overflow:ellipsis}
.qb-title{flex:1;font-size:var(--qb-input-font-size);font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.qb-hint{display:flex;align-items:center;gap:6px;color:var(--qb-fg-subtle);font-size:12px;white-space:nowrap;flex-shrink:0;cursor:pointer;border-radius:6px;padding:3px 4px 3px 7px}
.qb-hint:hover{color:var(--qb-fg-muted);background:var(--qb-hover)}
.qb-arg-cmd{display:flex;align-items:center;gap:7px;font-weight:500;white-space:nowrap;flex-shrink:0}
.qb-arg{height:30px;width:150px;min-width:80px;flex-shrink:1;border:1px solid var(--qb-border);border-radius:7px;padding:0 9px;background:var(--qb-hover);outline:none}
.qb-arg:focus{border-color:var(--qb-accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--qb-accent) 22%,transparent)}
select.qb-arg{padding-right:4px}

.qb-progress{position:absolute;left:0;right:0;bottom:-1px;height:1px;overflow:hidden;pointer-events:none;opacity:0;transition:opacity .2s}
.qb-progress[data-active]{opacity:1}
.qb-progress::after{content:"";position:absolute;top:0;bottom:0;width:35%;background:linear-gradient(90deg,transparent,var(--qb-accent),transparent);animation:qb-slide 1.1s ease-in-out infinite}

.qb-body{position:relative;display:flex;height:min(var(--qb-list-height),calc(100vh - var(--qb-top) - 130px));min-height:120px;overflow:hidden}
.qb-root[data-qb-inline] .qb-body{height:var(--qb-list-height)}
.qb-scroll{flex:1;min-width:0;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-color:color-mix(in srgb,var(--qb-fg) 18%,transparent) transparent;outline:none}
.qb-list{padding:6px 8px 8px;scroll-padding:8px 0}
.qb-list-inner{position:relative}
.qb-section{display:flex;align-items:flex-end;height:var(--qb-section-height);padding:0 10px 6px;color:var(--qb-fg-subtle);font-size:11.5px;font-weight:600;letter-spacing:.01em;user-select:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.qb-item{position:relative;display:flex;align-items:center;gap:11px;height:var(--qb-row-height);padding:0 10px;border-radius:var(--qb-radius-item);cursor:pointer;user-select:none;-webkit-user-select:none;scroll-margin:8px}
.qb-item[aria-selected=true]{background:var(--qb-selection);color:var(--qb-selection-fg)}
.qb-item[aria-selected=true]::before{content:"";position:absolute;left:0;top:25%;bottom:25%;width:2px;border-radius:2px;background:var(--qb-accent);opacity:var(--qb-indicator,0)}
.qb-item-icon{display:flex;align-items:center;justify-content:center;width:20px;height:20px;flex-shrink:0;color:var(--qb-fg-muted)}
.qb-item[aria-selected=true] .qb-item-icon{color:inherit}
.qb-icon{display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;line-height:1}
.qb-icon img{width:18px;height:18px;border-radius:4px;object-fit:cover}
.qb-icon-text{font-size:15px;width:20px}
.qb-icon-tinted{color:var(--qb-tint)}
.qb-item-text{display:flex;align-items:baseline;gap:8px;flex:1;min-width:0;overflow:hidden;white-space:nowrap}
.qb-item-title{overflow:hidden;text-overflow:ellipsis;flex-shrink:0;max-width:100%}
.qb-item-subtitle{color:var(--qb-fg-subtle);font-size:.93em;overflow:hidden;text-overflow:ellipsis;min-width:0}
.qb-item-accessories{display:flex;align-items:center;gap:12px;color:var(--qb-fg-subtle);font-size:12.5px;flex-shrink:0;margin-left:auto}
.qb-item-kind{color:var(--qb-fg-subtle);font-size:12.5px;flex-shrink:0;opacity:0}
.qb-item[aria-selected=true] .qb-item-kind{opacity:1}
.qb-accessory{display:inline-flex;align-items:center;gap:5px;white-space:nowrap}
.qb-match{background:none;color:var(--qb-highlight);font-weight:600}
.qb-tag{display:inline-flex;align-items:center;height:19px;padding:0 7px;border-radius:999px;font-size:11.5px;font-weight:500;color:var(--qb-tint,var(--qb-fg-muted));background:color-mix(in srgb,var(--qb-tint,var(--qb-fg-muted)) 15%,transparent)}
.qb-kbds{display:inline-flex;align-items:center;gap:3px}
.qb-kbd{display:inline-flex;align-items:center;justify-content:center;min-width:20px;height:20px;padding:0 5px;border-radius:5px;background:var(--qb-kbd-bg);color:var(--qb-kbd-fg);font:500 11.5px/1 var(--qb-font);box-shadow:inset 0 -1px 0 color-mix(in srgb,var(--qb-fg) 8%,transparent)}
.qb-kbd-then{font-size:11px;color:var(--qb-fg-subtle);padding:0 2px}

.qb-empty{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:24px;text-align:center;color:var(--qb-fg-muted)}
.qb-empty .qb-icon{color:var(--qb-fg-subtle);margin-bottom:6px}
.qb-empty-title{color:var(--qb-fg);font-weight:500}
.qb-empty-desc{font-size:13px;max-width:360px}
.qb-empty .qb-kbds{margin:0 2px}

.qb-footer{display:flex;align-items:center;justify-content:space-between;gap:12px;height:42px;padding:0 8px 0 14px;border-top:1px solid var(--qb-border);color:var(--qb-fg-muted);font-size:12.5px;flex-shrink:0}
.qb-footer-left{display:flex;align-items:center;gap:8px;min-width:0;overflow:hidden;white-space:nowrap}
.qb-footer-left>span:last-child{overflow:hidden;text-overflow:ellipsis}
.qb-footer-right{display:flex;align-items:center;gap:4px;flex-shrink:0}
.qb-footer-btn{display:inline-flex;align-items:center;gap:7px;height:28px;padding:0 6px 0 8px;border-radius:7px;white-space:nowrap;transition:background .1s}
.qb-footer-btn:hover{background:var(--qb-hover)}
.qb-footer-btn.qb-primary{color:var(--qb-fg);font-weight:500}
.qb-footer-sep{width:1px;height:14px;background:var(--qb-border);margin:0 2px}
.qb-toast{display:flex;align-items:center;gap:7px;min-width:0}
.qb-toast-title{color:var(--qb-fg);font-weight:500}
.qb-toast[data-style=success] .qb-icon{color:var(--qb-success)}
.qb-toast[data-style=failure] .qb-icon{color:var(--qb-danger)}
.qb-toast[data-style=loading] .qb-icon{color:var(--qb-fg-muted)}
.qb-toast[data-style=info] .qb-icon{color:var(--qb-accent)}
.qb-brand{color:var(--qb-fg-subtle);text-decoration:none;display:inline-flex;align-items:center;gap:6px}
.qb-brand:hover{color:var(--qb-fg-muted)}

.qb-actions{position:absolute;right:8px;bottom:48px;z-index:3;width:min(330px,calc(100% - 16px));max-height:min(380px,calc(100% - 64px));display:flex;flex-direction:column;background:var(--qb-bg-elevated);border:1px solid var(--qb-border);border-radius:12px;box-shadow:0 16px 48px -8px rgba(0,0,0,.35),0 0 0 1px rgba(0,0,0,.02);overflow:hidden;animation:qb-pop .14s var(--qb-ease);transform-origin:100% 100%}
.qb-actions-title{padding:9px 14px 4px;color:var(--qb-fg-subtle);font-size:11.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.qb-actions-list{overflow-y:auto;padding:4px 6px 6px;scrollbar-width:thin}
.qb-actions .qb-section{height:26px;padding-bottom:4px}
.qb-action{display:flex;align-items:center;gap:10px;height:34px;padding:0 8px;border-radius:7px;cursor:pointer;user-select:none;white-space:nowrap}
.qb-action[aria-selected=true]{background:var(--qb-selection);color:var(--qb-selection-fg)}
.qb-action[data-style=destructive]{color:var(--qb-danger)}
.qb-action .qb-icon{width:18px;color:var(--qb-fg-muted)}
.qb-action[data-style=destructive] .qb-icon{color:inherit}
.qb-action-title{flex:1;overflow:hidden;text-overflow:ellipsis}
.qb-actions-input{border:0;border-top:1px solid var(--qb-border);background:transparent;outline:none;height:38px;padding:0 14px;font-size:13px}
.qb-actions-input::placeholder{color:var(--qb-fg-subtle)}

.qb-detail{flex:1;min-width:0;overflow-y:auto;padding:18px 22px 22px;scrollbar-width:thin}
.qb-detail:focus,.qb-chat:focus,.qb-form:focus,.qb-dialog:focus{outline:none}
.qb-split .qb-list{flex:0 0 42%;border-right:1px solid var(--qb-border)}
.qb-split .qb-item-accessories,.qb-split .qb-item-kind{display:none}
.qb-split .qb-detail{padding:14px 18px}
.qb-meta{flex:0 0 34%;border-left:1px solid var(--qb-border);padding:14px 16px;overflow-y:auto;display:flex;flex-direction:column;gap:12px;font-size:13px}
.qb-meta-label{color:var(--qb-fg-subtle);font-size:12px;margin-bottom:2px}
.qb-meta-value{display:flex;align-items:center;gap:6px;flex-wrap:wrap;word-break:break-word}
.qb-meta a{color:var(--qb-accent);text-decoration:none}

.qb-md{font-size:14px;line-height:1.65;word-wrap:break-word;color:var(--qb-fg)}
.qb-md>*:first-child{margin-top:0}
.qb-md>*:last-child{margin-bottom:0}
.qb-md p,.qb-md ul,.qb-md ol,.qb-md blockquote,.qb-md .qb-code,.qb-md .qb-table{margin:0 0 .8em}
.qb-md h1,.qb-md h2,.qb-md h3,.qb-md h4{margin:1.2em 0 .5em;line-height:1.3;font-weight:650}
.qb-md h1{font-size:1.45em}.qb-md h2{font-size:1.25em}.qb-md h3{font-size:1.08em}.qb-md h4{font-size:1em}
.qb-md ul,.qb-md ol{padding-left:1.4em}
.qb-md li{margin:.2em 0}
.qb-md li>ul,.qb-md li>ol{margin:.2em 0}
.qb-md a{color:var(--qb-accent);text-decoration:underline;text-decoration-color:color-mix(in srgb,var(--qb-accent) 40%,transparent);text-underline-offset:2px}
.qb-md code{font-family:var(--qb-font-mono);font-size:.88em;padding:.12em .38em;border-radius:5px;background:color-mix(in srgb,var(--qb-fg) 7%,transparent)}
.qb-md .qb-code{border:1px solid var(--qb-border);border-radius:10px;overflow:hidden;background:color-mix(in srgb,var(--qb-fg) 3.5%,transparent)}
.qb-md .qb-code-head{display:flex;justify-content:space-between;align-items:center;padding:5px 8px 5px 12px;font-size:11.5px;color:var(--qb-fg-subtle);border-bottom:1px solid var(--qb-border)}
.qb-md .qb-code-copy{font-size:11.5px;padding:2px 7px;border-radius:5px;color:var(--qb-fg-muted)}
.qb-md .qb-code-copy:hover{background:var(--qb-hover);color:var(--qb-fg)}
.qb-md pre{margin:0;padding:12px 14px;overflow-x:auto;font-size:12.5px;line-height:1.55}
.qb-md pre code{padding:0;background:none;font-size:inherit}
.qb-md blockquote{padding:.1em 0 .1em 1em;border-left:3px solid var(--qb-border);color:var(--qb-fg-muted)}
.qb-md hr{border:0;border-top:1px solid var(--qb-border);margin:1.2em 0}
.qb-md img{max-width:100%;border-radius:8px}
.qb-md .qb-table{overflow-x:auto}
.qb-md table{border-collapse:collapse;width:100%;font-size:13px}
.qb-md th,.qb-md td{border-bottom:1px solid var(--qb-border);padding:6px 10px;text-align:left}
.qb-md th{font-weight:600;color:var(--qb-fg-muted)}
.qb-md input[type=checkbox]{margin:0 .3em 0 0;vertical-align:-.1em;accent-color:var(--qb-accent)}

.qb-form{flex:1;overflow-y:auto;padding:20px 26px;display:grid;grid-template-columns:minmax(90px,30%) 1fr;gap:14px 16px;align-content:start;scrollbar-width:thin}
.qb-form-label{padding-top:7px;text-align:right;color:var(--qb-fg-muted);font-size:13px}
.qb-form-label[data-required]::after{content:" *";color:var(--qb-fg-subtle)}
.qb-field{display:flex;flex-direction:column;gap:5px;min-width:0}
.qb-field-input{width:100%;height:34px;padding:0 10px;border:1px solid var(--qb-border);border-radius:8px;background:color-mix(in srgb,var(--qb-fg) 3%,transparent);outline:none;transition:border-color .1s,box-shadow .1s}
textarea.qb-field-input{height:auto;min-height:96px;padding:8px 10px;resize:vertical;line-height:1.5}
.qb-field-input:focus{border-color:var(--qb-accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--qb-accent) 22%,transparent)}
.qb-field-input[aria-invalid=true]{border-color:var(--qb-danger)}
.qb-field-check{display:flex;align-items:center;gap:8px;height:34px}
.qb-field-check input{width:16px;height:16px;accent-color:var(--qb-accent)}
.qb-field-desc{font-size:12px;color:var(--qb-fg-subtle)}
.qb-field-error{font-size:12px;color:var(--qb-danger)}

.qb-grid{flex:1;overflow-y:auto;padding:8px 12px 12px;display:grid;grid-template-columns:repeat(var(--qb-columns,5),minmax(0,1fr));gap:8px;align-content:start;scrollbar-width:thin}
.qb-grid .qb-section{grid-column:1/-1}
.qb-cell{display:flex;flex-direction:column;gap:6px;padding:4px;border-radius:12px;cursor:pointer;min-width:0;user-select:none}
.qb-cell-media{position:relative;aspect-ratio:var(--qb-aspect,1);display:flex;align-items:center;justify-content:center;border-radius:9px;background:var(--qb-hover);overflow:hidden;outline:2px solid transparent;outline-offset:1px;transition:outline-color .1s;font-size:32px;color:var(--qb-fg-muted)}
.qb-cell-media img{width:100%;height:100%;object-fit:var(--qb-fit,cover)}
.qb-cell-media .qb-icon svg{width:28px;height:28px}
.qb-cell-media .qb-icon-text{font-size:inherit;width:auto}
.qb-cell-media .qb-icon img{width:44%;height:44%;border-radius:8px}
.qb-cell[aria-selected=true] .qb-cell-media{outline-color:var(--qb-accent)}
.qb-cell-title{font-size:12.5px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:0 2px}
.qb-cell-subtitle{font-size:11.5px;color:var(--qb-fg-subtle);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:0 2px;margin-top:-4px}

.qb-chat{flex:1;overflow-y:auto;padding:18px 22px 22px;display:flex;flex-direction:column;gap:16px;scrollbar-width:thin}
.qb-msg-user{align-self:flex-end;max-width:85%;padding:8px 13px;border-radius:14px 14px 4px 14px;background:var(--qb-selection);white-space:pre-wrap;word-wrap:break-word}
.qb-msg-ai{display:flex;flex-direction:column;gap:8px;min-width:0}
.qb-msg-ai .qb-md:empty{display:none}
.qb-msg-head{display:flex;align-items:center;gap:7px;color:var(--qb-fg-subtle);font-size:12px;font-weight:500}
.qb-msg-head .qb-icon{color:var(--qb-accent)}
.qb-tools{display:flex;flex-wrap:wrap;gap:6px}
.qb-tool{display:inline-flex;align-items:center;gap:6px;max-width:100%;padding:3px 9px 3px 7px;border:1px solid var(--qb-border);border-radius:999px;font-size:12px;color:var(--qb-fg-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.qb-tool[data-state=done] .qb-icon{color:var(--qb-success)}
.qb-tool[data-state=error] .qb-icon{color:var(--qb-danger)}
.qb-msg-error{color:var(--qb-danger);font-size:13px}
.qb-caret{display:inline-block;width:7px;height:1em;margin-left:2px;vertical-align:-.15em;background:var(--qb-accent);border-radius:1px;animation:qb-blink 1s steps(2) infinite}
.qb-chat-empty{margin:auto;text-align:center;color:var(--qb-fg-muted);display:flex;flex-direction:column;align-items:center;gap:10px;max-width:420px}
.qb-chat-empty .qb-icon{color:var(--qb-accent)}
.qb-suggestions{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin-top:4px}
.qb-suggestion{padding:5px 11px;border:1px solid var(--qb-border);border-radius:999px;font-size:12.5px;color:var(--qb-fg-muted);transition:background .1s,color .1s}
.qb-suggestion:hover{background:var(--qb-hover);color:var(--qb-fg)}

.qb-spin svg{animation:qb-rot .7s linear infinite}

.qb-confirm-layer{position:absolute;inset:0;z-index:4;display:flex;align-items:center;justify-content:center;background:color-mix(in srgb,var(--qb-bg) 55%,transparent);-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);animation:qb-fade .12s}
.qb-confirm{width:min(340px,calc(100% - 32px));padding:20px;border:1px solid var(--qb-border);border-radius:14px;background:var(--qb-bg-elevated);box-shadow:0 20px 50px -10px rgba(0,0,0,.4);text-align:center;animation:qb-pop .16s var(--qb-ease)}
.qb-confirm-title{font-weight:600;font-size:15px}
.qb-confirm-msg{margin-top:6px;color:var(--qb-fg-muted);font-size:13px}
.qb-confirm-buttons{display:flex;gap:8px;margin-top:18px}
.qb-btn{flex:1;display:inline-flex;align-items:center;justify-content:center;gap:8px;height:34px;padding:0 12px;border-radius:8px;border:1px solid var(--qb-border);font-weight:500;transition:filter .1s,background .1s}
.qb-btn:not(.qb-btn-primary,.qb-btn-danger):hover{background:var(--qb-hover)}
.qb-btn:focus-visible{outline:2px solid var(--qb-accent);outline-offset:1px}
.qb-btn-primary{background:var(--qb-accent);color:var(--qb-accent-fg);border-color:transparent}
.qb-btn-primary:hover,.qb-btn-danger:hover{filter:brightness(1.08)}
.qb-btn-danger{background:var(--qb-danger);color:#fff;border-color:transparent}

.qb-hud{position:fixed;left:50%;bottom:32px;translate:-50% 0;z-index:calc(var(--qb-z) + 2);display:flex;align-items:center;gap:8px;max-width:calc(100vw - 32px);padding:9px 16px 9px 12px;border:1px solid var(--qb-border);border-radius:999px;background:var(--qb-bg-elevated);color:var(--qb-fg);box-shadow:0 12px 32px -8px rgba(0,0,0,.3);font-size:13px;animation:qb-hud .22s var(--qb-ease);pointer-events:none}
.qb-hud .qb-toast-msg{color:var(--qb-fg-muted)}

@keyframes qb-fade{from{opacity:0}}
@keyframes qb-fade-out{to{opacity:0}}
@keyframes qb-in{from{opacity:0;scale:.97;translate:-50% -6px}}
@keyframes qb-out{to{opacity:0;scale:.98}}
@keyframes qb-pop{from{opacity:0;scale:.96}}
@keyframes qb-hud{from{opacity:0;translate:-50% 10px}}
@keyframes qb-slide{from{left:-35%}to{left:100%}}
@keyframes qb-rot{to{rotate:360deg}}
@keyframes qb-blink{50%{opacity:0}}
.qb-root[data-qb-inline] .qb-dialog{animation:none}

@media (max-width:640px){
.qb-dialog{top:8px;width:calc(100vw - 16px)}
.qb-body{height:min(var(--qb-list-height),58vh)}
.qb-footer-left,.qb-hint{display:none}
.qb-footer{justify-content:flex-end}
.qb-form{grid-template-columns:1fr}
.qb-form-label{text-align:left;padding:0}
.qb-meta,.qb-split .qb-detail{display:none}
.qb-split .qb-list{flex:1;border:0}
}
@media (prefers-reduced-motion:reduce){
.qb-root *,.qb-root *::before,.qb-root *::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition:none!important}
.qb-progress::after{animation:qb-slide 1.6s linear infinite!important}
}
`
