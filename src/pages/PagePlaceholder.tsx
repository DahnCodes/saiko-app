type PagePlaceholderProps = { title: string; description: string }

export default function PagePlaceholder({ title, description }: PagePlaceholderProps) {
  return <section className="placeholder"><p className="eyebrow">Coming next</p><h1>{title}</h1><p>{description}</p></section>
}
