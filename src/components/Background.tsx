export default function Background() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* deep base gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(125%_125%_at_50%_10%,#0b1030_0%,#05060f_55%,#02030a_100%)]" />

      {/* floating colour blobs */}
      <div className="absolute -left-24 top-[-6rem] h-[28rem] w-[28rem] animate-float rounded-full bg-[#7c8cff]/30 blur-[90px]" />
      <div
        className="absolute right-[-8rem] top-24 h-[26rem] w-[26rem] animate-float rounded-full bg-[#ff6bd0]/25 blur-[90px]"
        style={{ animationDelay: "-3s" }}
      />
      <div
        className="absolute bottom-[-10rem] left-1/3 h-[30rem] w-[30rem] animate-float rounded-full bg-[#38d9a9]/20 blur-[100px]"
        style={{ animationDelay: "-6s" }}
      />

      {/* subtle grain / noise via radial dots */}
      <div className="absolute inset-0 opacity-[0.04] [background-image:radial-gradient(#fff_1px,transparent_1px)] [background-size:22px_22px]" />
    </div>
  );
}
