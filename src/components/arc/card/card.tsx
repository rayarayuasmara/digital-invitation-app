"use client";

import { forwardRef, type HTMLAttributes, type ReactNode, type Ref } from "react";
import styles from "./card.module.css";

export type CardVariant = "default" | "raised" | "outlined" | "ghost";
export type CardPadding = "none" | "sm" | "md" | "lg";

export interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, "ref"> {
  /** Visual style variant. */
  variant?: CardVariant;
  /** Internal padding. */
  padding?: CardPadding;
  /** Optional click handler makes the card a button (adds cursor/press states). */
  onClick?: () => void;
  /** ARIA label when card is interactive. */
  ariaLabel?: string;
  /** Children content. */
  children: ReactNode;
  /** Optional header rendered at top with border separator. */
  header?: ReactNode;
  /** Optional footer rendered at bottom with border separator. */
  footer?: ReactNode;
}

/**
 * Arc Card — a consistent surface for grouping content.
 * Uses design tokens for spacing, radius, elevation, and color.
 */
export const Card = forwardRef<HTMLDivElement, CardProps>(
  function Card(
    { variant = "default", padding = "md", onClick, ariaLabel, children, header, footer, className, style, ...restProps },
    ref: Ref<HTMLDivElement>
  ) {
    const isInteractive = typeof onClick === "function";
    const rootProps: HTMLAttributes<HTMLDivElement> = {
      className: [
        styles.root,
        styles[variant],
        styles[`pad-${padding}`],
        isInteractive ? styles.interactive : "",
        className,
      ].filter(Boolean).join(" "),
      style,
      onClick: isInteractive ? onClick : undefined,
      role: isInteractive ? "button" : undefined,
      tabIndex: isInteractive ? 0 : undefined,
      "aria-label": isInteractive ? ariaLabel : undefined,
      onKeyDown: isInteractive
        ? (e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onClick?.();
            }
          }
        : undefined,
      ...restProps,
    };

    return (
      <div ref={ref} {...rootProps}>
        {header && <div className={styles.header}>{header}</div>}
        <div className={styles.content}>{children}</div>
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    );
  }
);

Card.displayName = "Card";

/**
 * CardHeader — semantic header with consistent typography and spacing.
 */
export interface CardHeaderProps extends Omit<HTMLAttributes<HTMLDivElement>, "ref" | "title"> {
  /** Title text. */
  title: ReactNode;
  /** Optional subtitle/description. */
  description?: ReactNode;
  /** Optional action rendered at end (e.g., button, link). */
  action?: ReactNode;
  /** Divider below header. Default true. */
  divider?: boolean;
}

export function CardHeader({ title, description, action, divider = true, className, ...props }: CardHeaderProps) {
  return (
    <div className={[styles.headerWrap, divider ? styles.headerDivided : "", className].filter(Boolean).join(" ")} {...props}>
      <div className={styles.headerText}>
        <div className={styles.headerTitle}>{title}</div>
        {description && <div className={styles.headerDescription}>{description}</div>}
      </div>
      {action && <div className={styles.headerAction}>{action}</div>}
    </div>
  );
}

/**
 * CardFooter — semantic footer with consistent spacing.
 */
export interface CardFooterProps extends Omit<HTMLAttributes<HTMLDivElement>, "ref"> {
  children: ReactNode;
  divider?: boolean;
  className?: string;
}

export function CardFooter({ children, divider = true, className, ...props }: CardFooterProps) {
  return (
    <div className={[styles.footerWrap, divider ? styles.footerDivided : "", className].filter(Boolean).join(" ")} {...props}>
      {children}
    </div>
  );
}

/**
 * CardSection — a named section inside a card with optional divider.
 */
export interface CardSectionProps extends Omit<HTMLAttributes<HTMLDivElement>, "ref"> {
  /** Section label. */
  label: ReactNode;
  /** Optional value/description rendered opposite label. */
  value?: ReactNode;
  /** Divider below section. Default false. */
  divider?: boolean;
  className?: string;
}

export function CardSection({ label, value, divider = false, className, ...props }: CardSectionProps) {
  return (
    <div className={[styles.section, divider ? styles.sectionDivided : "", className].filter(Boolean).join(" ")} {...props}>
      <div className={styles.sectionLabel}>{label}</div>
      {value && <div className={styles.sectionValue}>{value}</div>}
    </div>
  );
}