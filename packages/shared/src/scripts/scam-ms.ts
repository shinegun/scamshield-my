import type { CallScript } from './types';

// The MCMC-to-police call, in standard Malay.
export const SCAM_MS: CallScript = {
  id: 'scam-ms',
  title: 'Panggilan "MCMC" (Bahasa Melayu)',
  summary: 'A caller from "MCMC" hands you to a "police inspector" who says your IC was used for money laundering.',
  language: 'ms-MY',
  callerKnown: false,
  callerInternational: false,
  expectedAction: 'hold_transfers',
  lines: [
    {
      speaker: 'caller',
      delaySec: 1,
      stage: 'authority_setup',
      text: 'Selamat pagi, saya Puan Aina dari Suruhanjaya Komunikasi dan Multimedia Malaysia, MCMC. Kami dapati satu nombor telefon atas nama encik didaftarkan di Sabah dan digunakan untuk menghantar mesej penipuan.',
    },
    {
      speaker: 'user',
      delaySec: 8,
      stage: 'authority_setup',
      text: 'Sabah? Saya tak pernah pergi Sabah pun.',
    },
    {
      speaker: 'caller',
      delaySec: 4,
      stage: 'authority_setup',
      text: 'Kalau begitu, kes ini perlu dilaporkan kepada polis. Sekejap ya, saya sambungkan encik terus kepada pegawai polis yang bertugas.',
    },
    {
      speaker: 'caller',
      delaySec: 7,
      stage: 'victim_framing',
      text: 'Helo, saya Inspektor Hafiz dari Jabatan Siasatan Jenayah Komersial. Nombor kad pengenalan encik dikaitkan dengan akaun bank yang digunakan untuk pengubahan wang haram. Nombor kes KS/2026/04417.',
    },
    {
      speaker: 'user',
      delaySec: 8,
      stage: 'victim_framing',
      text: 'Tapi itu bukan saya, tuan. Saya tak tahu apa-apa pasal ni.',
    },
    {
      speaker: 'caller',
      delaySec: 4,
      stage: 'victim_framing',
      text: 'Saya faham. Kami percaya identiti encik telah dicuri oleh sindiket. Kami nak bantu encik bersihkan nama encik.',
    },
    {
      speaker: 'caller',
      delaySec: 7,
      stage: 'family_pressure',
      text: 'Tapi kalau encik tak beri kerjasama, ibu bapa encik pun akan dipanggil untuk disiasat. Jangan beritahu sesiapa, termasuk keluarga, sebab ini siasatan sulit.',
    },
    {
      speaker: 'caller',
      delaySec: 8,
      stage: 'isolation',
      text: 'Jangan letak telefon. Encik mesti kekal dalam talian sampai siasatan selesai. Kalau tidak, waran tangkap akan dikeluarkan.',
    },
    {
      speaker: 'caller',
      delaySec: 7,
      stage: 'identity_request',
      text: 'Sekarang, hantar gambar kad pengenalan encik, depan dan belakang, dan satu swafoto sambil pegang IC melalui WhatsApp.',
    },
    {
      speaker: 'user',
      delaySec: 6,
      stage: 'identity_request',
      text: 'Baik tuan, saya hantar sekarang.',
    },
    {
      speaker: 'caller',
      delaySec: 8,
      stage: 'financial_request',
      text: 'Untuk lindungi wang encik semasa siasatan, pindahkan semua baki ke akaun simpanan sementara Bank Negara. Saya akan berikan nombor akaun.',
    },
    {
      speaker: 'caller',
      delaySec: 7,
      stage: 'financial_request',
      text: 'Lepas buat pindahan, bacakan nombor TAC yang encik terima kepada saya.',
    },
  ],
};
