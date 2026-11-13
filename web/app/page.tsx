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
            Healthcare help,
            <br />
            made <span className="underline">simpler.</span>
          </h1>
          <p>Ask Tulong which aid can cover your hospital bill, follow your case, and see every peso paid straight to the hospital.</p>
          <div className="home-cta">
            <Link href="/family" className="btn primary">
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
        <Link href="/family" className="card home-card">
          <span className="ic">
            <Icon name="chat" size={24} />
          </span>
          <div>
            <b>I&apos;m a family member</b>
            <span>Enter the case code from the social worker, then ask Tulong in Taglish, English or Filipino.</span>
          </div>
        </Link>
        <Link href="/staff" className="card home-card">
          <span className="ic">
            <Icon name="folder" size={24} />
          </span>
          <div>
            <b>I&apos;m a social worker</b>
            <span>Open cases, review Tulong&apos;s plan and approve it with your MetaMask wallet.</span>
          </div>
        </Link>
        <Link href="/activity" className="card home-card">
          <span className="ic">
            <Icon name="shield" size={24} />
          </span>
          <div>
            <b>Track every peso</b>
            <span>Every payment and every refusal, on a public record with no names.</span>
          </div>
        </Link>
      </div>
    </div>
  );
}
