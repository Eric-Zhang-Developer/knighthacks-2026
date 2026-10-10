"use client";

import { useEffect, useState } from "react";
import { ClaimBadge, PanelState } from "@/components/ui";
import { setState } from "@/lib/store";
import { KINDS, kindText, type Assumption, type Kind } from "./change-mind";
import { layout } from "./constellation";
import styles from "./challenge.module.css";

// "Assumption map": the idea at the centre and one fixed cluster per kind. An edge joins two assumptions only when
// they cite a same source project; nothing is inferred from wording. Static layout, no motion.
export default function AssumptionMap({ versionId, items }: { versionId: string; items: Assumption[] }) {
  const [selected, setSelected] = useState<number | null>(null);
  const [titles, setTitles] = useState<Record<string, string>>({});

  // Assumptions cite only the version's evidence-card projects, so the cards name them. GET never calls the model.
  useEffect(() => {
    if (!items.some((a) => a.assumption.sourceIds.length)) return;
    fetch(`/api/evidence/${encodeURIComponent(versionId)}`)
      .then((r) => (r.ok ? r.json() : { cards: [] }))
      .then((j: { cards: { projectId: string; title: string }[] }) => setTitles(Object.fromEntries(j.cards.map((c) => [c.projectId, c.title]))))
      .catch(() => {});
  }, [versionId, items]);

  const { nodes, edges, clusters } = layout(items);
  const chosen = selected === null ? null : items[selected];

  return (
    <section aria-label="Assumption map" className={styles.experiments}>
      <h3 className={styles.subheading}>Assumption map</h3>
      {items.length === 0 ? (
        <PanelState kind="empty" message='No assumptions yet. Use "What would change your mind?" above to list them.' />
      ) : (
        <>
          <div className={styles.map}>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden className={styles.mapSvg}>
              {edges.map(([a, b]) => (
                <line key={`${a}-${b}`} data-edge={`${a}-${b}`} x1={nodes[a].x} y1={nodes[a].y} x2={nodes[b].x} y2={nodes[b].y} className={styles.edge} />
              ))}
            </svg>
            <span className={styles.centre} style={{ left: "50%", top: "50%" }}>
              Your idea
            </span>
            {KINDS.map((k: Kind) => (
              <span key={k} className={styles.cluster} data-cluster={k} style={{ left: `${clusters[k].x}%`, top: `${clusters[k].y - 17}%` }}>
                {kindText(k)}
              </span>
            ))}
            {nodes.map((n, i) => (
              <button
                key={i}
                type="button"
                className={styles.node}
                data-kind={n.kind}
                aria-label={items[i].assumption.text}
                aria-pressed={selected === i}
                title={items[i].assumption.text}
                style={{ left: `${n.x}%`, top: `${n.y}%` }}
                onClick={() => setSelected(i)}
              >
                {i + 1}
              </button>
            ))}
          </div>
          {chosen && (
            <div className={styles.experiment} aria-label="Selected assumption" role="group">
              <p className={styles.source}>
                <ClaimBadge label={chosen.assumption.label} /> {chosen.assumption.text}
              </p>
              <p className={styles.label}>{kindText(chosen.kind)}</p>
              {chosen.assumption.sourceIds.length > 0 ? (
                <div className={styles.row}>
                  <span className={styles.label}>Cited:</span>
                  {chosen.assumption.sourceIds.map((id) => (
                    <button key={id} type="button" onClick={() => setState({ selectedProjectId: id })}>
                      {titles[id] ?? `Project ${id.slice(0, 8)}`}
                    </button>
                  ))}
                </div>
              ) : (
                <p className={styles.label}>Cites no project.</p>
              )}
              {chosen.reversal ? (
                <>
                  <p>
                    <span className={styles.label}>Check:</span> {chosen.reversal.observe}
                  </p>
                  <p>
                    <span className={styles.label}>Changes my mind if:</span> {chosen.reversal.reversesIf}
                  </p>
                </>
              ) : (
                <p className={styles.insufficient}>Evidence is insufficient: nothing concrete would test this yet.</p>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
