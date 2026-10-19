import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Sparkles,
  Zap,
  ShieldCheck,
  BarChart3,
  Users,
  Clock,
  CheckCircle2,
} from "lucide-react";

export const Route = createFileRoute("/")({
  component: LandingPage,
  head: () => ({
    meta: [
      { title: "CLIPYARD · AI Studio Workspace" },
      {
        name: "description",
        content:
          "Interactive 3D workspace for CLIPYARD — an autonomous clip factory with 6 AI agents, live pipeline tracking, and real-time studio simulation.",
      },
    ],
  }),
});

function LandingPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-[#e4e7f8] via-[#f0f2fb] to-[#eef0fb] text-[#232746] selection:bg-[#232746]/10">
      {/* Hero */}
      <section className="relative overflow-hidden px-6 pt-28 pb-16 md:pt-36 md:pb-24">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col items-start gap-10 lg:flex-row lg:items-end lg:gap-20">
            <div className="max-w-2xl space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#232746]/10 bg-white/60 px-3.5 py-1.5 text-[11px] font-extrabold tracking-[0.12em] text-[#6d28d9] shadow-sm backdrop-blur-md">
                <Sparkles className="h-3.5 w-3.5" /> GLASS DIORAMA V3
              </div>
              <h1 className="font-display text-[clamp(2.5rem,6vw,4.5rem)] font-extrabold leading-[0.95] tracking-tight text-[#232746]">
                Kantor Virtual
                <br />
                <span className="text-[#6d28d9]">CLIPYARD</span>
              </h1>
              <p className="max-w-md text-[15.5px] font-medium leading-relaxed text-[#6b6b7a]">
                Diorama kantor kaca isometrik 3D dengan 6 robot agen AI yang bekerja 24/7
                sesuai pengaturanmu, pipeline hidup, dan armada diecast — hangat menyala di atas panggung navy gelap.
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Link
                  to="/hq"
                  className="inline-flex items-center gap-2.5 rounded-2xl bg-[#232746] px-6 py-3.5 text-sm font-extrabold tracking-tight text-white shadow-[0_10px_30px_-10px_rgba(35,39,70,0.55)] transition-transform hover:scale-[1.03] hover:shadow-[0_14px_36px_-10px_rgba(35,39,70,0.6)] active:scale-[0.98]"
                >
                  Masuk Studio <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/aktivitas"
                  className="inline-flex items-center gap-2 rounded-2xl border border-[#232746]/10 bg-white/50 px-6 py-3.5 text-sm font-extrabold text-[#232746] shadow-sm backdrop-blur-md transition hover:border-[#232746]/20 hover:bg-white hover:shadow-md"
                >
                  Buka Dasbor Kelola
                </Link>
                <a
                  href="#fitur"
                  className="inline-flex items-center gap-2 rounded-2xl border border-[#232746]/10 bg-white/50 px-6 py-3.5 text-sm font-extrabold text-[#232746] shadow-sm backdrop-blur-md transition hover:border-[#232746]/20 hover:bg-white hover:shadow-md"
                >
                  Lihat Fitur
                </a>
              </div>
            </div>
            <div className="relative w-full lg:w-[520px] lg:shrink-0">
              <div className="relative overflow-hidden rounded-[28px] border border-[#232746]/8 bg-gradient-to-br from-white/80 to-[#f0f2fb]/60 shadow-[0_28px_60px_-24px_rgba(35,39,70,0.28)] backdrop-blur-xl">
                <img
                  src="/screenshots/studio-night.png"
                  alt="CLIPYARD glass diorama di malam hari"
                  className="w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#232746]/20 via-transparent to-transparent" />
                <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
                  <span className="rounded-full bg-[#232746]/80 px-3 py-1 text-[10px] font-extrabold tracking-wider text-white backdrop-blur-md">
                    LIVE PREVIEW
                  </span>
                  <span className="rounded-full bg-white/90 px-3 py-1 text-[10px] font-extrabold tracking-wider text-[#232746] shadow-sm backdrop-blur-md">
                    ISOMETRIK LOCK
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="fitur" className="mx-auto max-w-6xl px-6 pb-24">
        <div className="mb-12 text-center">
          <h2 className="font-display text-3xl font-extrabold tracking-tight text-[#232746] md:text-4xl">
            Setiap Bagian Dirancang
          </h2>
          <p className="mt-3 text-[14.5px] font-medium text-[#6b6b7a]">
            Optimalisasi menyeluruh — visual, performa, dan pengalaman.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          <FeatureCard
            icon={<Zap className="h-5 w-5 text-[#22d3ee]" />}
            title="Panel Kerja Agen"
            desc="Klik robotnya: lihat tugas berjalan, hasil yang selesai, beri tugas baru, dan konfigurasi nama, peran & tanggung jawabnya — langsung tercermin di robot."
          />
          <FeatureCard
            icon={<Clock className="h-5 w-5 text-[#a78bfa]" />}
            title="Mode Kerja Fleksibel"
            desc="Tiap agen bisa diatur selalu aktif 24/7, mengikuti jadwal jam tertentu, atau manual. Jam kantor 9–5 tinggal mode demo opsional — pekerjaan tidak pernah berhenti karenanya."
          />
          <FeatureCard
            icon={<ShieldCheck className="h-5 w-5 text-[#34d399]" />}
            title="Konektor Pipeline Asli"
            desc="Panel UI untuk menyambungkan Studio ke Floor API + n8n: atur URL, token & polling, tes koneksi, kirim job uji — tanpa menyentuh .env."
          />
          <FeatureCard
            icon={<BarChart3 className="h-5 w-5 text-[#fbbf24]" />}
            title="Dasbor Kelola"
            desc="Halaman aktivitas, statistik, laporan Markdown siap unduh, manajer draft dokumen, dan pengelolaan agen — semua membaca lantai live yang sama."
          />
          <FeatureCard
            icon={<Users className="h-5 w-5 text-[#f472b6]" />}
            title="Ruang Kaca"
            desc="Meeting room + ruang rehat berdinding kaca rangka hitam — robot masuk lewat pintu geser sungguhan."
          />
          <FeatureCard
            icon={<Sparkles className="h-5 w-5 text-[#fb923c]" />}
            title="Detailing Interior"
            desc="Lantai kayu oak hangat, pod meja berpasangan, lampu tripod sudut, tanaman, dan kucing kantor yang berjalan sendiri."
          />
        </div>
      </section>

      {/* Details */}
      <section className="border-t border-[#232746]/6 bg-white/50 px-6 py-20 backdrop-blur-sm">
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-10 md:grid-cols-2 md:items-center md:gap-16">
            <div className="space-y-5">
              <h3 className="font-display text-2xl font-extrabold tracking-tight text-[#232746] md:text-3xl">
                Desain Setiap Bagian
              </h3>
              <p className="text-[14.5px] font-medium leading-relaxed text-[#6b6b7a]">
                Diorama kompak dua dinding: tiga pod meja berpasangan di area terbuka,
                dua ruang kaca di sisi timur (rapat + rehat), jendela skyline malam,
                dan credenza diecast di bawahnya. Semua menyatu di atas slab navy gelap.
              </p>
              <ul className="space-y-2.5 pt-1">
                {[
                  "Palet malam hangat: krem, kayu oak, rangka hitam, aksen amber lampu",
                  "Tekstur lantai kayu oak prosedural (grain + sambungan)",
                  "Partisi kaca rangka hitam ala render referensi + pintu geser",
                  "Lampu tripod sudut + point light hangat + shadow lembut real-time",
                  "Kucing kantor berjalan dengan animasi bernapas dan ekor bergoyang",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-[13.5px] font-medium text-[#6b6b7a]">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#047857]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="relative overflow-hidden rounded-[28px] border border-[#232746]/8 shadow-[0_28px_60px_-24px_rgba(35,39,70,0.22)]">
              <img
                src="/screenshots/studio-day.png"
                alt="CLIPYARD glass diorama di siang hari"
                className="w-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Performance */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="rounded-[28px] border border-[#232746]/8 bg-gradient-to-br from-[#232746] to-[#3a3f75] p-10 text-white shadow-[0_30px_70px_-24px_rgba(35,39,70,0.55)] md:p-14">
          <div className="mx-auto max-w-4xl text-center">
            <h3 className="font-display text-2xl font-extrabold tracking-tight md:text-3xl">
              Optimalisasi Performa
            </h3>
            <p className="mt-4 text-[14.5px] font-medium leading-relaxed text-[#a9b4d0]">
              Setiap bagian dioptimalkan untuk kecepatan dan kualitas visual: geometri statis
              di-merge per material, instancing untuk daun dan mug, satu shadow map lembut
              untuk kedalaman sinematik, canvas texture di-redraw hanya saat diperlukan,
              dan AdaptiveDpr menurunkan resolusi otomatis saat perangkat berat.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
                <p className="text-2xl font-extrabold text-white">±17</p>
                <p className="mt-1 text-[12px] font-semibold text-[#a9b4d0]">Draw call statis</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
                <p className="text-2xl font-extrabold text-white">0.5s</p>
                <p className="mt-1 text-[12px] font-semibold text-[#a9b4d0]">Refresh whiteboard</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
                <p className="text-2xl font-extrabold text-white">±38°</p>
                <p className="mt-1 text-[12px] font-semibold text-[#a9b4d0]">Orbit isometrik terkunci</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#232746]/6 bg-[#eef0fb]/60 px-6 py-8 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#232746] to-[#6d28d9] text-sm font-extrabold text-white shadow-md">
              C
            </span>
            <div>
              <p className="text-[13px] font-extrabold leading-tight text-[#232746]">CLIPYARD</p>
              <p className="text-[10px] font-semibold text-[#6b6b7a]">Autonomous Clip Factory</p>
            </div>
          </div>
          <Link
            to="/hq"
            className="inline-flex items-center gap-2 rounded-2xl bg-[#232746] px-5 py-2.5 text-[12px] font-extrabold text-white shadow-md transition hover:scale-[1.03] hover:bg-[#2a2d4f]"
          >
            Masuk Studio <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </footer>
    </main>
  );
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="rounded-[20px] border border-[#232746]/8 bg-white/70 p-6 shadow-[0_14px_30px_-14px_rgba(35,39,70,0.1)] backdrop-blur-md transition hover:shadow-[0_20px_40px_-14px_rgba(35,39,70,0.15)] hover:-translate-y-0.5">
      <div className="mb-4 inline-flex rounded-2xl border border-[#232746]/6 bg-white p-2.5 shadow-sm">
        {icon}
      </div>
      <h4 className="text-[15px] font-extrabold tracking-tight text-[#232746]">{title}</h4>
      <p className="mt-2 text-[13px] font-medium leading-relaxed text-[#6b6b7a]">{desc}</p>
    </div>
  );
}
