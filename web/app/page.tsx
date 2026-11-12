import Link from "next/link";
import { Logo } from "@/components/Icons";

// Home: everyone starts here and picks who they are.
export default function Home() {
  return (
    <div className="home">
      <div className="home-hero">
        <Logo />
        <h1>Tanglaw</h1>
        <p>Medical aid, explained by AI and paid in public.</p>
      </div>
      <div className="home-grid">
        <Link href="/family" className="card home-card">
          <b>I&apos;m a family member</b>
          <span>Ask Tulong about aid for a hospital bill and follow your case. You need the case code from the social worker.</span>
        </Link>
        <Link href="/staff" className="card home-card">
          <b>I&apos;m a social worker</b>
          <span>Open cases, review Tulong&apos;s payment plans and approve them. Sign in with your MetaMask wallet.</span>
        </Link>
        <Link href="/activity" className="card home-card">
          <b>View public record</b>
          <span>Every aid payment the contract made, with proof on the blockchain. No names. No sign-in.</span>
        </Link>
      </div>
    </div>
  );
}
