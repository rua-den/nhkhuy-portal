import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="shell">
      <header class="topbar">
        <a class="brand" href="/" aria-label="NHKHUY home"><span class="mark">N_</span> NHKHUY<span class="muted">.RUN.PLACE</span></a>
        <span class="status"><i></i> PORTAL V2 / FOUNDATION</span>
      </header>
      <section class="hero">
        <p class="eyebrow">PERSONAL INFRASTRUCTURE / 2026</p>
        <h1>CONTROL<span>_</span>DECK</h1>
        <p class="copy">A clearer command center for the services running in my corner of the internet.</p>
        <div class="rule"></div>
        <p class="notice">V2 FOUNDATION ONLINE <span>— AUTHENTICATION AND SERVICE MANAGEMENT ARE NEXT.</span></p>
      </section>
      <footer>NHKHUY PORTAL <span>BUILD 2.0 / NOT IN PRODUCTION</span></footer>
    </main>
  `,
  styles: [`
    :host { display:block; min-height:100vh; }
    .shell { width:min(1080px, calc(100% - 48px)); margin:0 auto; min-height:100vh; display:flex; flex-direction:column; }
    .topbar { height:76px; display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid #20332a; font-size:12px; letter-spacing:.12em; }
    .brand { color:#e7f1eb; text-decoration:none; font-weight:800; }
    .mark { color:#9be5b4; margin-right:10px; }
    .muted, footer span { color:#71877a; }
    .status { color:#9be5b4; font-size:10px; }
    .status i { display:inline-block; width:7px; height:7px; border-radius:50%; background:#83e6a6; margin-right:8px; box-shadow:0 0 12px #83e6a6; }
    .hero { margin:auto 0; padding:100px 0; }
    .eyebrow, .notice { color:#9be5b4; font-size:11px; letter-spacing:.18em; }
    h1 { font-size:clamp(48px, 10vw, 112px); line-height:.95; letter-spacing:-.075em; margin:24px 0; }
    h1 span { color:#9be5b4; }
    .copy { max-width:560px; color:#a5b5aa; font-size:18px; line-height:1.7; }
    .rule { width:100%; height:1px; background:#20332a; margin:48px 0 24px; }
    .notice span { color:#71877a; }
    footer { display:flex; justify-content:space-between; padding:24px 0; border-top:1px solid #20332a; color:#9be5b4; font-size:10px; letter-spacing:.14em; }
    @media (max-width:600px) { .shell { width:calc(100% - 32px); } .status { font-size:0; } .status i { font-size:initial; } footer { gap:16px; flex-direction:column; } }
  `]
})
export class AppComponent {}
