import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type * as React from "react";

export interface LayoutProps {
  preview: string;
  supportEmail: string;
  children: React.ReactNode;
}

const ivory = "#FBF7F2";
const wine = "#6B2135";
const ink = "#2B2724";
const muted = "#7A716B";

export function Layout({ preview, supportEmail, children }: LayoutProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body
        style={{
          backgroundColor: ivory,
          margin: 0,
          padding: "32px 0",
          fontFamily:
            'ui-sans-serif, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif',
          color: ink,
        }}
      >
        <Container
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: 12,
            maxWidth: 520,
            margin: "0 auto",
            padding: "32px",
          }}
        >
          <Text
            style={{
              color: wine,
              fontSize: 24,
              fontWeight: 600,
              letterSpacing: "-0.01em",
              margin: "0 0 24px",
            }}
          >
            Unsaid
          </Text>
          <Section>{children}</Section>
          <Hr style={{ borderColor: "#EDE5DB", margin: "32px 0 16px" }} />
          <Text style={{ color: muted, fontSize: 12, lineHeight: "18px", margin: 0 }}>
            Unsaid identifies differences between the answers you provide. It cannot
            determine whether a relationship will succeed or what decisions you should
            make. Unsaid is a structured communication tool—not therapy, counseling,
            diagnosis, or medical advice. You must be 18 or older.
          </Text>
          <Text style={{ color: muted, fontSize: 12, margin: "12px 0 0" }}>
            Questions? <Link href={`mailto:${supportEmail}`}>{supportEmail}</Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export function Paragraph({ children }: { children: React.ReactNode }) {
  return (
    <Text style={{ fontSize: 16, lineHeight: "26px", margin: "0 0 16px" }}>
      {children}
    </Text>
  );
}

export function CallToAction({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      style={{
        backgroundColor: wine,
        borderRadius: 8,
        color: "#FFFFFF",
        display: "inline-block",
        fontSize: 16,
        fontWeight: 600,
        padding: "12px 24px",
        textDecoration: "none",
      }}
    >
      {label}
    </Link>
  );
}
