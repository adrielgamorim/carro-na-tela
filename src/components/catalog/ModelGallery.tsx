import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Expand, X } from "lucide-react";
import { angleLabels, largerThumb, photosOfYear } from "../../catalog/gallery";
import type { GalleryAngle } from "../../catalog/gallery";
import type { CatalogEntry } from "../../catalog/types";
import { useModelGallery } from "../../hooks/useModelGallery";
import "./ModelGallery.css";

interface Slide {
  thumb: string;
  page: string;
  angle?: GalleryAngle;
  artist?: string;
  license?: string;
}

/** Commons serves standard thumbnail widths; the catalog keeps the 500 px one. */
const largePhoto = (thumb: string) => largerThumb(thumb, 960);

/**
 * The model's photos for the entry's model year: the main one, then the
 * gallery's (front, rear, side, interior), with thumbnails and an enlarged
 * view. All are of the model line, not of this exact version.
 */
export function ModelGallery({ entry }: { entry: CatalogEntry }) {
  const model = entry.wikidata;
  const gallery = useModelGallery(model?.id, Boolean(model?.gallery));
  const [current, setCurrent] = useState(0);
  const [enlarged, setEnlarged] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);

  const main = model?.image;
  const slides: Slide[] = [
    ...(main ? [{ ...main, thumb: largePhoto(main.thumb) }] : []),
    ...photosOfYear(gallery, entry.modelYear).filter((photo) => photo.page !== main?.page),
  ];
  const index = Math.min(current, Math.max(0, slides.length - 1));
  const slide = slides[index];
  const label = model?.label ?? entry.family;

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (enlarged && !element.open) element.showModal();
    if (!enlarged && element.open) element.close();
  }, [enlarged]);

  if (!slide) return null;
  const go = (step: number) => setCurrent((index + step + slides.length) % slides.length);
  const credit = [slide.artist, slide.license].filter(Boolean).join(", ");
  const alt = `${label}${slide.angle ? ` (${angleLabels[slide.angle].toLowerCase()})` : ""}, foto ilustrativa do modelo`;

  return (
    <figure className="model-gallery">
      <div className="model-gallery-stage">
        <button type="button" className="model-gallery-open" onClick={() => setEnlarged(true)} aria-label="Ampliar foto">
          <img
            src={slide.thumb}
            alt={alt}
            decoding="async"
            // Small originals have no 960 px thumbnail.
            onError={(event) => {
              const smaller = largerThumb(slide.thumb, 500);
              if (event.currentTarget.src !== smaller) event.currentTarget.src = smaller;
            }}
          />
          <span className="model-gallery-expand" aria-hidden="true">
            <Expand size={15} />
          </span>
        </button>
        {slides.length > 1 && (
          <>
            <button type="button" className="model-gallery-step model-gallery-prev" onClick={() => go(-1)} aria-label="Foto anterior">
              <ChevronLeft size={20} />
            </button>
            <button type="button" className="model-gallery-step model-gallery-next" onClick={() => go(1)} aria-label="Próxima foto">
              <ChevronRight size={20} />
            </button>
            <span className="model-gallery-count">
              {index + 1}/{slides.length}
            </span>
          </>
        )}
      </div>

      {slides.length > 1 && (
        <ul className="model-gallery-thumbs" aria-label={`Fotos de ${label}`}>
          {slides.map((item, position) => (
            <li key={item.page}>
              <button
                type="button"
                className={position === index ? "model-gallery-thumb-active" : undefined}
                aria-current={position === index ? "true" : undefined}
                aria-label={item.angle && item.angle !== "outra" ? angleLabels[item.angle] : `Foto ${position + 1}`}
                onClick={() => setCurrent(position)}
              >
                <img src={largerThumb(item.thumb, 250)} alt="" loading="lazy" decoding="async" />
                {item.angle && item.angle !== "outra" && <span>{angleLabels[item.angle]}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}

      <figcaption>
        Foto ilustrativa do modelo ·{" "}
        <a href={slide.page} target="_blank" rel="noreferrer">
          {credit ? `${credit} · ` : ""}Wikimedia Commons
        </a>
      </figcaption>

      <dialog
        ref={dialog}
        className="model-gallery-dialog"
        aria-label={`Fotos de ${label}`}
        onClose={() => setEnlarged(false)}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") go(-1);
          if (event.key === "ArrowRight") go(1);
        }}
        onClick={(event) => {
          // A click on the backdrop (the dialog itself, not its content) closes it.
          if (event.target === event.currentTarget) setEnlarged(false);
        }}
      >
        {enlarged && (
          <div className="model-gallery-dialog-body">
            <img
              src={largerThumb(slide.thumb, 1280)}
              alt={alt}
              // Originals narrower than 1280 px have no such thumbnail.
              onError={(event) => {
                if (event.currentTarget.src !== slide.thumb) event.currentTarget.src = slide.thumb;
              }}
            />
            <p>
              {slide.angle && slide.angle !== "outra" ? `${angleLabels[slide.angle]} · ` : ""}
              {index + 1}/{slides.length} ·{" "}
              <a href={slide.page} target="_blank" rel="noreferrer">
                {credit ? `${credit} · ` : ""}Wikimedia Commons
              </a>
            </p>
            {slides.length > 1 && (
              <>
                <button type="button" className="model-gallery-step model-gallery-prev" onClick={() => go(-1)} aria-label="Foto anterior">
                  <ChevronLeft size={24} />
                </button>
                <button type="button" className="model-gallery-step model-gallery-next" onClick={() => go(1)} aria-label="Próxima foto">
                  <ChevronRight size={24} />
                </button>
              </>
            )}
            <button type="button" className="model-gallery-close" onClick={() => setEnlarged(false)} aria-label="Fechar">
              <X size={20} />
            </button>
          </div>
        )}
      </dialog>
    </figure>
  );
}
