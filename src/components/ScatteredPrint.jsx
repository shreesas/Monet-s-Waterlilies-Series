// One of the J1-J9 woodblock prints. Wrapped in the small museum frame
// (thick black border + thin gold liner) so it reads as a framed artwork on
// the wall. Clicks open the fullscreen lightbox.
//
// `maxSize` is applied to BOTH max-width and max-height (with width/height
// auto), so the image's longer dimension always equals `maxSize`. That means
// the WIDTH of a horizontal/landscape print equals the HEIGHT of a vertical/
// portrait print, regardless of orientation.
export default function ScatteredPrint({
  src,
  alt,
  style,
  maxSize,
  onSelect,
}) {
  return (
    <img
      src={src}
      alt={alt}
      draggable={false}
      onClick={onSelect}
      className="absolute cursor-pointer select-none museum-frame-sm"
      style={{
        ...style,
        maxWidth: maxSize,
        maxHeight: maxSize,
        width: "auto",
        height: "auto",
        transform: "translate(-50%, -50%)",
      }}
    />
  );
}
