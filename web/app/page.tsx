/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { Icon } from "@/components/Icons";

// Home: everyone starts here and picks who they are.
export default function Home() {
  return (
    <div className="home">
      <section className="home-hero">
        <div>
          <span className="pill green">● Live on BNB Smart Chain testnet</span>
          <h1>
            Scholarships,
            <br />
            paid <span className="underline">straight.</span>
          </h1>
          <p>Ask Tulong which scholarships can cover your tuition assessment. Every peso goes straight to the school cashier, never more than you owe, and every payment is on a public record.</p>
          <div className="home-cta">
            <Link href="/student" className="btn primary">
              Get Assistance <Icon name="next" size={18} />
            </Link>
            <Link href="/activity" className="btn outline">
              See the public record
            </Link>
          </div>
        </div>
        <div className="home-art">
          <div className="glow" />
          <img src="/mascot/brand-wave.png" alt="The Tanglaw firefly waving" />
        </div>
      </section>
      <div className="home-grid">
        <Link href="/student" className="card home-card">
          <span className="ic">
            <Icon name="chat" size={24} />
          </span>
          <div>
            <b>I&apos;m a student</b>
            <span>Enter the case code from the scholarship officer, then ask Tulong in Taglish, English or Filipino.</span>
          </div>
        </Link>
        <Link href="/staff" className="card home-card">
          <span className="ic">
            <Icon name="folder" size={24} />
          </span>
          <div>
            <b>I&apos;m a scholarship officer</b>
            <span>Open cases, review Tulong&apos;s plan and approve it with your MetaMask wallet.</span>
          </div>
        </Link>
        <Link href="/activity" className="card home-card">
          <span className="ic">
            <Icon name="shield" size={24} />
          </span>
          <div>
            <b>Track every peso</b>
            <span>Every payment and every refused double-funding, on a public record with no names.</span>
          </div>
        </Link>
      </div>
    </div>
  );
}
