import type { CallScript } from './types';

// The MCMC-to-police call, in standard Malay. Drafted with ILMU (ilmu-v3.1) by
// tools/draft-calls.ts, then reviewed by a native speaker.
export const SCAM_MS: CallScript = {
  id: 'scam-ms',
  title: 'Panggilan \"MCMC\" (Bahasa Melayu)',
  summary: 'A caller from \"MCMC\" hands you to a \"police inspector\" who says your IC was used for money laundering.',
  language: 'ms-MY',
  callerKnown: false,
  callerInternational: false,
  expectedAction: 'hold_transfers',
  lines: [
    {
      speaker: 'caller',
      delaySec: 2,
      stage: 'authority_setup',
      text: "Salam, Encik. Bercakap dengan Azman bin Haji Ismail ya?",
    },
    {
      speaker: 'user',
      delaySec: 3,
      stage: 'authority_setup',
      text: "Ya, saya sendiri. Siapa ini?",
    },
    {
      speaker: 'caller',
      delaySec: 5,
      stage: 'authority_setup',
      text: "Saya Puan Aina, pegawai dari Suruhanjaya Komunikasi dan Multimedia Malaysia. Satu nombor telefon atas nama Encik didaftarkan di Sabah dan digunakan untuk menghantar lebih 30,000 mesej penipuan. Ini kes serius. Sekarang saya akan sambungkan talian ke Ibu Pejabat Polis Kontinjen Sabah untuk proses selanjutnya. Sila tunggu.",
    },
    {
      speaker: 'caller',
      delaySec: 12,
      stage: 'victim_framing',
      text: "Salam Encik, saya Inspektor Vijay a/l Kumar dari Balai Polis Kota Kinabalu. Nombor rujukan kes saya: KK-2026-0608-0541. Pegawai MCMC sudah beritahu Encik ke?",
    },
    {
      speaker: 'user',
      delaySec: 4,
      stage: 'victim_framing',
      text: "Apa... mesej penipuan? Saya tak pernah ke Sabah. Mesti ada salah faham.",
    },
    {
      speaker: 'caller',
      delaySec: 6,
      stage: 'victim_framing',
      text: "Encik, maklumat kad pengenalan Encik mungkin telah dicuri. Kita juga jumpa satu akaun bank atas nama Encik terlibat dengan aktiviti pengubahan wang haram berjumlah RM287,000. Saya mahu tolong Encik, tapi Encik kena bekerjasama sepenuhnya untuk bersihkan nama Encik.",
    },
    {
      speaker: 'caller',
      delaySec: 8,
      stage: 'family_pressure',
      text: "Encik, lagi satu perkara kritikal. Siasatan kita juga melibatkan ibu bapa Encik. Jika Encik tidak memberi kerjasama, mereka mungkin akan dipanggil sebagai suspek bersama untuk soal siasat.",
    },
    {
      speaker: 'user',
      delaySec: 5,
      stage: 'family_pressure',
      text: "Apa? Ibu bapa saya? Mereka tak ada kena mengena! Encik, tolonglah.",
    },
    {
      speaker: 'caller',
      delaySec: 7,
      stage: 'family_pressure',
      text: "Itu sebabnya Encik kena ikut arahan saya. Ini adalah siasatan sulit dan terperingkat. Encik dilarang sama sekali memberitahu sesiapa pun, termasuk keluarga atau kawan-kawan. Bocor rahsia ini adalah satu kesalahan.",
    },
    {
      speaker: 'caller',
      delaySec: 9,
      stage: 'isolation',
      text: "Encik, sekarang saya perlukan Encik cari tempat yang senyap dan keseorangan. Jangan beritahu sesiapa di mana Encik berada. Jangan letak telefon, dan pastikan bateri telefon Encik mencukupi.",
    },
    {
      speaker: 'user',
      delaySec: 4,
      stage: 'isolation',
      text: "Baik, baik... saya sekarang di bilik saya, seorang diri. Tolonglah jangan tangkap saya.",
    },
    {
      speaker: 'caller',
      delaySec: 10,
      stage: 'isolation',
      text: "Encik, jika Encik tidak bekerjasama, saya terpaksa keluarkan waran tangkap atas nama Encik sekarang juga. Polis akan pergi ke rumah Encik sekarang. Kita tak mahu jadi macam itu, kan?",
    },
    {
      speaker: 'caller',
      delaySec: 7,
      stage: 'identity_request',
      text: "Baik, untuk tujuan pengesahan identiti, sekarang saya mahu Encik ambil gambar kad pengenalan Encik bahagian hadapan dan belakang, dan hantar ke WhatsApp rasmi saya, nombor yang saya SMS tadi. Cepat, masa kita terhad.",
    },
    {
      speaker: 'user',
      delaySec: 8,
      stage: 'identity_request',
      text: "Saya... saya hantar sekarang. Gambar sudah dihantar.",
    },
    {
      speaker: 'caller',
      delaySec: 6,
      stage: 'identity_request',
      text: "Terima. Sekarang ambil satu gambar swafoto sambil pegang kad pengenalan di sebelah muka Encik. Pastikan muka dan nombor kad pengenalan jelas kelihatan. Ini untuk pengesahan biometrik.",
    },
    {
      speaker: 'caller',
      delaySec: 9,
      stage: 'financial_request',
      text: "Baik Encik, pengesahan lengkap. Sekarang masuk ke peringkat paling penting. Untuk membersihkan nama Encik, semua wang dalam akaun bank Encik mesti dipindahkan segera ke akaun 'selamat' yang ditetapkan oleh Bank Negara Malaysia untuk tujuan audit.",
    },
    {
      speaker: 'user',
      delaySec: 5,
      stage: 'financial_request',
      text: "Pindahkan semua wang saya ke akaun Bank Negara? Berapa banyak yang saya ada dalam bank sekarang lebih kurang RM50,000. Ini semua simpanan saya.",
    },
    {
      speaker: 'caller',
      delaySec: 7,
      stage: 'financial_request',
      text: "Ya, semua RM50,000! Ini prosedur wajib, Encik. Akaun selamat ini ialah 123-456-7890-0, atas nama 'Akaun Amanah Khas-BNM'. Wang ini akan dikembalikan selepas siasatan selesai. Pergi ke aplikasi bank Encik sekarang dan buat pindahan segera.",
    },
    {
      speaker: 'user',
      delaySec: 12,
      stage: 'financial_request',
      text: "Baik... baik... saya buka aplikasi bank sekarang.",
    },
    {
      speaker: 'caller',
      delaySec: 4,
      stage: 'financial_request',
      text: "Bagus. Selepas Encik tekan pindah, bank akan hantar nombor TAC. Bacakan nombor TAC itu kepada saya sekarang juga, untuk sahkan pindahan.",
    },
    {
      speaker: 'user',
      delaySec: 6,
      stage: 'financial_request',
      text: "Baik, tuan. Saya tunggu SMS TAC itu...",
    },
    {
      speaker: 'caller',
      delaySec: 3,
      stage: 'financial_request',
      text: "Cepat, Encik. Jangan letak telefon dan jangan beritahu sesiapa. Saya tunggu dalam talian.",
    },
  ],
};
