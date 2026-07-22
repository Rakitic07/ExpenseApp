export default function Background() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* deep base gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(125%_125%_at_50%_10%,#0b1030_0%,#05060f_55%,#02030a_100%)]" />

      {/*
       * Static colour blobs. These are intentionally NOT animated: any movement
       * behind the glass panels forces the browser to re-rasterize every
       * backdrop-filter each frame, which is the single biggest cause of jank
       * (especially on phones). Keeping them still lets the GPU cache the blur.
       */}
      <div className="absolute -left-24 top-[-6rem] h-[26rem] w-[26rem] rounded-full bg-[#7c8cff]/25 blur-[80px]" />
      <div className="absolute right-[-8rem] top-24 h-[24rem] w-[24rem] rounded-full bg-[#ff6bd0]/20 blur-[80px]" />
      <div className="absolute bottom-[-10rem] left-1/3 h-[26rem] w-[26rem] rounded-full bg-[#38d9a9]/15 blur-[90px]" />

      {/* subtle grain / noise via radial dots */}
      <div className="absolute inset-0 opacity-[0.04] [background-image:radial-gradient(#fff_1px,transparent_1px)] [background-size:22px_22px]" />
    </div>
  );
}
