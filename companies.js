/* ============================================================
   ServisDrama — Firma Veritabanı + Logo
   NOT: Bu dosyayı companies.js olarak kaydet
   ============================================================ */

var LOGO_SRC = 'data:image/png;base64,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';

var SD_COMPANIES = [
  {
    "id": "c1",
    "name": "NSK OTOMOTİV SANAYİ VE TİCARET ANONİM ŞİRKETİ",
    "bolge": "KARACABEY",
    "techId": "t1",
    "salesRepId": "u3",
    "email": "",
    "truck": false,
    "weeks": [
      1,
      2,
      3,
      4
    ],
    "aMails": [],
    "lat": null,
    "lng": null,
    "konumNot": ""
  },
  {
    "id": "c2",
    "name": "TEKNOFORM MAKİNA İNŞ.SAN.TİC.LTD.ŞTİ.",
    "bolge": "NOSAB",
    "techId": "t1",
    "salesRepId": "u3",
    "email": "",
    "truck": false,
    "weeks": [
      1,
      2,
      3,
      4
    ],
    "aMails": [],
    "lat": null,
    "lng": null,
    "konumNot": ""
  },
  {
    "id": "c3",
    "name": "EJS ESKİŞEHİR JANT VE MAKİNA SAN. TİC. A.Ş.",
    "bolge": "ESKİŞEHİR",
    "techId": "t2",
    "salesRepId": "u4",
    "email": "",
    "truck": false,
    "weeks": [
      1,
      2,
      3,
      4
    ],
    "aMails": [],
    "lat": null,
    "lng": null,
    "konumNot": ""
  },
  {
    "id": "c4",
    "name": "ŞAHİNCE OTOMOTİV SANAYİ VE TİC.A.Ş.",
    "bolge": "OSB",
    "techId": "t1",
    "email": "",
    "truck": false,
    "weeks": [
      1,
      2,
      3,
      4
    ],
    "aMails": [],
    "lat": null,
    "lng": null,
    "konumNot": ""
  },
  {
    "id": "c5",
    "name": "DURMAZLAR MAKİNA SANAYİİ VE TİCARET A.Ş.",
    "bolge": "OSB",
    "techId": "t1",
    "email": "",
    "truck": false,
    "weeks": [
      1,
      2,
      3,
      4
    ],
    "aMails": [],
    "lat": null,
    "lng": null,
    "konumNot": ""
  },
  {
    "id": "c6",
    "name": "DEHA OTOMAT MAK.SAN.VE TİC.LTD.ŞTİ.",
    "bolge": "ÇALI",
    "techId": "t2",
    "email": "",
    "truck": false,
    "weeks": [
      1,
      3
    ],
    "aMails": [],
    "lat": null,
    "lng": null,
    "konumNot": ""
  },
  {
    "id": "c7",
    "name": "BAYKAL MAKİNA SANAYİ VE TİCARET ANONİM ŞİRKETİ",
    "bolge": "OSB",
    "techId": "t1",
    "email": "",
    "truck": false,
    "weeks": [
      1,
      2,
      3,
      4
    ],
    "aMails": [],
    "lat": null,
    "lng": null,
    "konumNot": ""
  },
  {
    "id": "c8",
    "name": "F.S.S. FREN SİSTEMLERİ SAN. VE TİC LTD. ŞTİ.",
    "bolge": "DEMİRTAŞ",
    "techId": "t1",
    "email": "",
    "truck": false,
    "weeks": [
      1,
      2,
      3,
      4
    ],
    "aMails": [],
    "lat": null,
    "lng": null,
    "konumNot": ""
  },
  {
    "id": "c9",
    "name": "SAMPA OTOMOTİV SANAYİ VE TİCARET ANONİM ŞİRKETİ",
    "bolge": "",
    "techId": "t2",
    "email": "",
    "truck": false,
    "weeks": [
      1,
      2,
      3,
      4
    ],
    "aMails": [],
    "lat": null,
    "lng": null,
    "konumNot": ""
  },
  {
    "id": "c10",
    "name": "BUSEL MAKİNA SAN.TIC.LTD.ŞTİ",
    "bolge": "ESKİŞEHİR",
    "techId": "t2",
    "email": "",
    "truck": false,
    "weeks": [
      1,
      2,
      3,
      4
    ],
    "aMails": [],
    "lat": null,
    "lng": null,
    "konumNot": ""
  },
  {
    "id": "c11",
    "name": "FENESE KALIP PLASTİK METAL SAN. TİC. LTD.ŞTİ.",
    "bolge": "NOSAB",
    "techId": "t1",
    "email": "",
    "truck": false,
    "weeks": [
      1,
      2,
      3,
      4
    ],
    "aMails": [],
    "lat": null,
    "lng": null,
    "konumNot": ""
  },
  {
    "id": "c12",
    "name": "DERİN HAVACILIK SANAYİ TİCARET ANONİM ŞİRKETİ",
    "bolge": "ESKİŞEHİR",
    "techId": "t2",
    "email": "",
    "truck": false,
    "weeks": [
      1,
      2,
      3,
      4
    ],
    "aMails": [],
    "lat": null,
    "lng": null,
    "konumNot": ""
  },
  {
    "id": "c13",
    "name": "DOĞU PRES OTOMOTİV VE TEKNİK SAN.VE TİC.A.Ş.",
    "bolge": "NOSAB",
    "techId": "t2",
    "email": "",
    "truck": false,
    "weeks": [
      1,
      2,
      3,
      4
    ],
    "aMails": [],
    "lat": null,
    "lng": null,
    "konumNot": ""
  },
  {
    "id": "c14",
    "name": "HÜNEL KALIP SAN.VE TİC.LTD.ŞTİ.",
    "bolge": "HOSAB",
    "techId": "t2",
    "email": "",
    "truck": false,
    "weeks": [
      2,
      4
    ],
    "aMails": [],
    "lat": null,
    "lng": null,
    "konumNot": ""
  },
  {
    "id": "c15",
    "name": "SET OTOMAT CNC TALAŞLI İMALAT TİC. LTD. ŞTİ.",
    "bolge": "ALTINOVA",
    "techId": "t2",
    "email": "",
    "truck": false,
    "weeks": [
      2,
      4
    ],
    "aMails": [],
    "lat": null,
    "lng": null,
    "konumNot": ""
  },
  {
    "id": "c16",
    "name": "TINAZ TARIM VE SANAYİ MAKİNALARI TİC VE SAN A.Ş.",
    "bolge": "BALIKESİR",
    "techId": "t1",
    "email": "",
    "truck": false,
    "weeks": [
      1,
      3
    ],
    "aMails": [],
    "lat": null,
    "lng": null,
    "konumNot": ""
  },
  {
    "id": "c17",
    "name": "DEKAS OTOMOTİV YAN SANAYİ TİCARET LİMİTED ŞİRKETİ",
    "bolge": "KÜÇÜKBALIKLI",
    "techId": "t1",
    "email": "",
    "truck": false,
    "weeks": [
      1,
      3
    ],
    "aMails": [],
    "lat": null,
    "lng": null,
    "konumNot": ""
  },
  {
    "id": "c18",
    "name": "YEMTAR MAKİNA SAN.TİC.A.Ş.",
    "bolge": "BANDIRMA",
    "techId": "t1",
    "email": "",
    "truck": false,
    "weeks": [
      1,
      3
    ],
    "aMails": [],
    "lat": null,
    "lng": null,
    "konumNot": ""
  },
  {
    "id": "c19",
    "name": "YARIŞ KABİN SAN.VE TİC.A.Ş.",
    "bolge": "BALIKESİR",
    "techId": "t1",
    "email": "",
    "truck": false,
    "weeks": [
      1,
      3
    ],
    "aMails": [],
    "lat": null,
    "lng": null,
    "konumNot": ""
  },
  {
    "id": "c20",
    "name": "PAKTERMO ÖLÇÜ ALETLERİ VE BORU SANAYİ VE TİC A.Ş.",
    "bolge": "OSB",
    "techId": "t2",
    "email": "",
    "truck": false,
    "weeks": [
      2,
      4
    ],
    "aMails": [],
    "lat": null,
    "lng": null,
    "konumNot": ""
  },
  {
    "id": "c21",
    "name": "FOM MAKİNA OTOMOTİV SAN.VE TİC.LTD.ŞTİ.",
    "bolge": "NOSAB",
    "techId": "t1",
    "email": "",
    "truck": false,
    "weeks": [
      2,
      4
    ],
    "aMails": [],
    "lat": null,
    "lng": null,
    "konumNot": ""
  },
  {
    "id": "c22",
    "name": "PİKOSAN METAL FORM SANAYİ VE TİCARET A.Ş",
    "bolge": "NOSAB",
    "techId": "t1",
    "email": "",
    "truck": false,
    "weeks": [
      2,
      4
    ],
    "aMails": [],
    "lat": null,
    "lng": null,
    "konumNot": ""
  },
  {
    "id": "c23",
    "name": "MSK FORGE METAL ANONİM ŞİRKETİ",
    "bolge": "KARACABEY",
    "techId": "t1",
    "email": "",
    "truck": false,
    "weeks": [
      1,
      2,
      3,
      4
    ],
    "aMails": [],
    "lat": null,
    "lng": null,
    "konumNot": ""
  },
  {
    "id": "c24",
    "name": "ALSTOM RAYLI SİSTEM SANAYİ ANONİM ŞİRKETİ",
    "bolge": "BAŞKÖY",
    "techId": "t1",
    "email": "",
    "truck": false,
    "weeks": [
      1,
      3
    ],
    "aMails": [],
    "lat": null,
    "lng": null,
    "konumNot": ""
  },
  {
    "id": "c25",
    "name": "PAKSAN MAKİNA SAN.VE TİC.A.Ş",
    "bolge": "BANDIRMA OSB",
    "techId": "t1",
    "email": "",
    "truck": false,
    "weeks": [
      1,
      3
    ],
    "aMails": [],
    "lat": null,
    "lng": null,
    "konumNot": ""
  },
  {
    "id": "c26",
    "name": "SYC DEMİR DÖKÜM VE MAKİNA SANAYİ TİC. A.Ş.",
    "bolge": "ESKİŞEHİR",
    "techId": "t2",
    "email": "",
    "truck": false,
    "weeks": [
      1,
      2,
      3,
      4
    ],
    "aMails": [],
    "lat": null,
    "lng": null,
    "konumNot": ""
  },
  {
    "id": "c27",
    "name": "MAKRONOVA MAKİNA SAN. VE TİC. LTD. ŞTİ.",
    "bolge": "ESKİŞEHİR",
    "techId": "t2",
    "email": "",
    "truck": false,
    "weeks": [
      2,
      4
    ],
    "aMails": [],
    "lat": null,
    "lng": null,
    "konumNot": ""
  },
  {
    "id": "c28",
    "name": "KUZU FLEX METAL SANAYİ VE TİCARET ANONİM ŞİRKETİ",
    "bolge": "GEMLİK SERBEST BÖLGE",
    "techId": "t1",
    "email": "",
    "truck": false,
    "weeks": [
      1,
      3
    ],
    "aMails": [],
    "lat": null,
    "lng": null,
    "konumNot": ""
  },
  {
    "id": "c29",
    "name": "KAMAK REKOR MAKİNA SANAYİ VE TİCARET ANONİM ŞİRKETİ",
    "bolge": "OSB",
    "techId": "t2",
    "email": "",
    "truck": false,
    "weeks": [
      1,
      3
    ],
    "aMails": [],
    "lat": null,
    "lng": null,
    "konumNot": ""
  },
  {
    "id": "c30",
    "name": "LEWİRON SAVUNMA SANAYİ İTHALAT İHRACAT LİMİTED ŞİRKETİ",
    "bolge": "YILDIRIM",
    "techId": "t2",
    "email": "",
    "truck": false,
    "weeks": [
      2,
      4
    ],
    "aMails": [],
    "lat": null,
    "lng": null,
    "konumNot": ""
  },
  {
    "id": "c31",
    "name": "SKE OTOMOTİV SANAYİ VE TİCARET A.Ş.",
    "bolge": "NOSAB",
    "techId": "t2",
    "email": "",
    "truck": false,
    "weeks": [
      2,
      4
    ],
    "aMails": [],
    "lat": null,
    "lng": null,
    "konumNot": ""
  },
  {
    "id": "c32",
    "name": "EMPO OTOMOTİV YEDEK PARÇA SANAYİ VE TİCARET A.Ş.",
    "bolge": "OSB",
    "techId": "t1",
    "email": "",
    "truck": false,
    "weeks": [
      1,
      3,
      4
    ],
    "aMails": [],
    "lat": null,
    "lng": null,
    "konumNot": ""
  },
  {
    "id": "c33",
    "name": "STANDARTKALIP METALFORM DİZAYN KALIP ELEMANLARI MAKİNA MÜHENDİSLİK SANAYİ VE TİCARET LİMİTED ŞİRKETİ",
    "bolge": "KAYAPA",
    "techId": "t1",
    "email": "",
    "truck": false,
    "weeks": [
      2,
      4
    ],
    "aMails": [],
    "lat": null,
    "lng": null,
    "konumNot": ""
  },
  {
    "id": "c34",
    "name": "ÖZBEŞLER MAKİNA OTOMOTİV VE KUYUMCULUK AKARYAKIT İNŞ. ASANSÖR SAN. TİC. LTD. ŞTİ",
    "bolge": "YILDIRIM",
    "techId": "t2",
    "email": "",
    "truck": false,
    "weeks": [
      1
    ],
    "aMails": [],
    "lat": null,
    "lng": null,
    "konumNot": ""
  },
  {
    "id": "c35",
    "name": "SU MAKİNA SANAYİ VE TİCARET LİMİTED ŞİRKETİ",
    "bolge": "ESKİŞEHİR",
    "techId": "t2",
    "email": "",
    "truck": false,
    "weeks": [
      3
    ],
    "aMails": [],
    "lat": null,
    "lng": null,
    "konumNot": ""
  },
  {
    "id": "c36",
    "name": "HİDROTEK REKOR MAKİNA OTOMOTİV İNŞAAT GIDA SAN. TİC. LTD. ŞTİ.",
    "bolge": "ÇALI",
    "techId": "t1",
    "email": "",
    "truck": false,
    "weeks": [
      1,
      3
    ],
    "aMails": [],
    "lat": null,
    "lng": null,
    "konumNot": ""
  },
  {
    "id": "c37",
    "name": "BEYÇELİK GESTAMP TEKNOLOJİ VE KALIP A.Ş.",
    "bolge": "TEKNOSAB",
    "techId": "t1",
    "email": "",
    "truck": false,
    "weeks": [
      1,
      3
    ],
    "aMails": [],
    "lat": null,
    "lng": null,
    "konumNot": ""
  },
  {
    "id": "c38",
    "name": "KURVALF VANA ANONİM ŞİRKETİ",
    "bolge": "ÇALI",
    "techId": "t1",
    "email": "",
    "truck": false,
    "weeks": [
      1,
      3
    ],
    "aMails": [],
    "lat": null,
    "lng": null,
    "konumNot": ""
  },
  {
    "id": "c39",
    "name": "YAKAR ÇELİK DÖVME EL ALETLERİ SANAYİ A.Ş.",
    "bolge": "BANDIRMA OSB",
    "techId": "t1",
    "email": "",
    "truck": false,
    "weeks": [
      1,
      3
    ],
    "aMails": [],
    "lat": null,
    "lng": null,
    "konumNot": ""
  },
  {
    "id": "c40",
    "name": "HİDRO HİDROLİK ENDÜSTRİ SANAYİ TİCARET A.Ş",
    "bolge": "OSB",
    "techId": "t2",
    "email": "",
    "truck": false,
    "weeks": [],
    "aMails": [],
    "lat": null,
    "lng": null,
    "konumNot": ""
  },
  {
    "id": "c41",
    "name": "ÇINA OTOMOTİV MAKİNA SAN.TİC.LTD.ŞTİ.",
    "bolge": "ESKİŞEHİR",
    "techId": "t2",
    "email": "",
    "truck": false,
    "weeks": [
      2,
      4
    ],
    "aMails": [],
    "lat": null,
    "lng": null,
    "konumNot": ""
  },
  {
    "id": "c42",
    "name": "BURÇAK METAL OTO. YAN SAN. TEKS. TUR. GIDA İNŞ. TİC. VE SAN. LTD. ŞTİ.",
    "bolge": "NOSAB",
    "techId": "t1",
    "email": "",
    "truck": false,
    "weeks": [
      1,
      2,
      3,
      4
    ],
    "aMails": [],
    "lat": null,
    "lng": null,
    "konumNot": ""
  },
  {
    "id": "c43",
    "name": "ÇELİKFORM GESTAMP OTOMOTİV A.Ş.",
    "bolge": "TEKNOSAB",
    "techId": "t1",
    "email": "",
    "truck": false,
    "weeks": [
      1,
      3
    ],
    "aMails": [],
    "lat": null,
    "lng": null,
    "konumNot": ""
  },
  {
    "id": "c44",
    "name": "PAYE MAKİNA VE METAL ÜRETİM TİC. A.Ş.",
    "bolge": "OSB",
    "techId": "t1",
    "email": "",
    "truck": false,
    "weeks": [
      2,
      4
    ],
    "aMails": [],
    "lat": null,
    "lng": null,
    "konumNot": ""
  },
  {
    "id": "c45",
    "name": "VATAN PRES OTOMOTİV SAN. VE TİC. A.Ş.",
    "bolge": "HOSAB",
    "techId": "t1",
    "email": "",
    "truck": false,
    "weeks": [
      2,
      4
    ],
    "aMails": [],
    "lat": null,
    "lng": null,
    "konumNot": ""
  },
  {
    "id": "c46",
    "name": "VOLKAN METAL SAN.TİC.LTD.ŞTİ.",
    "bolge": "BALIKESİR",
    "techId": "t1",
    "email": "",
    "truck": false,
    "weeks": [
      1,
      3
    ],
    "aMails": [],
    "lat": null,
    "lng": null,
    "konumNot": ""
  },
  {
    "id": "c47",
    "name": "REN-KA MAKİNA SANAYİ VE TİCARET LİMİTED ŞİRKETİ",
    "bolge": "OSB",
    "techId": "t2",
    "email": "",
    "truck": false,
    "weeks": [
      1,
      3
    ],
    "aMails": [],
    "lat": null,
    "lng": null,
    "konumNot": ""
  },
  {
    "id": "c48",
    "name": "ORVEN KAUÇUK MAKİNA YEDEK PARÇA TURİZM SANAYİ VE TİCARET ANONİM ŞİRKETİ",
    "bolge": "DEMİRTAŞ",
    "techId": "t2",
    "email": "",
    "truck": false,
    "weeks": [
      1
    ],
    "aMails": [],
    "lat": null,
    "lng": null,
    "konumNot": ""
  },
  {
    "id": "c49",
    "name": "BAYRAK LASTİK SANAYİ VE TİCARET A.Ş.",
    "bolge": "OSB",
    "techId": "t2",
    "email": "",
    "truck": false,
    "weeks": [
      1,
      3
    ],
    "aMails": [],
    "lat": null,
    "lng": null,
    "konumNot": ""
  },
  {
    "id": "c50",
    "name": "SVB GRUP OTOMOTİV SANAYİ VE TİCARET ANONİM ŞİRKETİ",
    "bolge": "OSB",
    "techId": "t1",
    "email": "",
    "truck": false,
    "weeks": [
      1,
      4
    ],
    "aMails": [],
    "lat": null,
    "lng": null,
    "konumNot": ""
  },
  {
    "id": "c51",
    "name": "GERA MAKİNA KALIP METAL SAN.TİC.A.Ş.",
    "bolge": "OSB",
    "techId": "t2",
    "email": "",
    "truck": false,
    "weeks": [
      1,
      3
    ],
    "aMails": [],
    "lat": null,
    "lng": null,
    "konumNot": ""
  },
  {
    "id": "c52",
    "name": "PROTAŞ PROJE MÜH.İNŞ.ELEKTRİK SAN.VE TİC.A.Ş.",
    "bolge": "BALIKESİR",
    "techId": "t1",
    "email": "",
    "truck": false,
    "weeks": [
      1,
      3
    ],
    "aMails": [],
    "lat": null,
    "lng": null,
    "konumNot": ""
  },
  {
    "id": "c53",
    "name": "ERDOĞANLAR TORNA TELESKOPİK PİSTON ÇELİK VE MAK.SAN.TİC.LTD.ŞTİ.",
    "bolge": "BALIKESİR",
    "techId": "t1",
    "email": "",
    "truck": false,
    "weeks": [
      1,
      4
    ],
    "aMails": [],
    "lat": null,
    "lng": null,
    "konumNot": ""
  },
  {
    "id": "c54",
    "name": "LANDE METAL MOBİLYA SANAYİ VE TİCARET LTD.ŞTİ.",
    "bolge": "ESKİŞEHİR",
    "techId": "t2",
    "email": "",
    "truck": false,
    "weeks": [
      1
    ],
    "aMails": [],
    "lat": null,
    "lng": null,
    "konumNot": ""
  },
  {
    "id": "c55",
    "name": "AUROTEC PAYE GROUP 5 EKSEN KALIP İŞLEME MER. A.Ş.",
    "bolge": "KAYAPA",
    "techId": "t1",
    "email": "",
    "truck": false,
    "weeks": [
      1,
      4
    ],
    "aMails": [],
    "lat": null,
    "lng": null,
    "konumNot": ""
  },
  {
    "id": "c56",
    "name": "NACETEK MAKİNA SANAYİ VE TİC.A.Ş.",
    "bolge": "NİLÜFERKÖY",
    "techId": "t2",
    "email": "",
    "truck": false,
    "weeks": [
      1
    ],
    "aMails": [],
    "lat": null,
    "lng": null,
    "konumNot": ""
  },
  {
    "id": "c57",
    "name": "BALIKESİR ELEKTROMEKANİK SANAYİ TESİSLERİ A.Ş",
    "bolge": "BALIKESİR",
    "techId": "t1",
    "email": "",
    "truck": false,
    "weeks": [
      2
    ],
    "aMails": [],
    "lat": null,
    "lng": null,
    "konumNot": ""
  },
  {
    "id": "c58",
    "name": "ALUNET MATERIAL SOLUTIONS ALÜMİNYUM SANAYİ VE TİCARET ANONİM ŞİRKETİ",
    "bolge": "OSB",
    "techId": "t1",
    "email": "",
    "truck": false,
    "weeks": [
      2,
      4
    ],
    "aMails": [],
    "lat": null,
    "lng": null,
    "konumNot": ""
  },
  {
    "id": "c59",
    "name": "İŞBİR ELEKTRİK SANAYİ ANONİM ŞİRKETİ",
    "bolge": "BALIKESİR",
    "techId": "t1",
    "email": "",
    "truck": false,
    "weeks": [
      1,
      3
    ],
    "aMails": [],
    "lat": null,
    "lng": null,
    "konumNot": ""
  },
  {
    "id": "c60",
    "name": "BURÇELİK BURSA ÇELİK DÖKÜM SAN.A.Ş.",
    "bolge": "OSB",
    "techId": "t2",
    "email": "",
    "truck": false,
    "weeks": [
      1,
      3
    ],
    "aMails": [],
    "lat": null,
    "lng": null,
    "konumNot": ""
  },
  {
    "id": "c61",
    "name": "KAYA TEKNİK CNC SANAYİ VE TİCARET LİMİTED ŞİRKETİ",
    "bolge": "OSB",
    "techId": "t2",
    "email": "",
    "truck": false,
    "weeks": [
      1
    ],
    "aMails": [],
    "lat": null,
    "lng": null,
    "konumNot": ""
  },
  {
    "id": "c62",
    "name": "ORAU ORHAN OTOMOTİV KONTROL SİSTEMLERİ SANAYİİ ANONİM ŞİRKETİ",
    "bolge": "KARACABEY",
    "techId": "t1",
    "email": "",
    "truck": false,
    "weeks": [
      1,
      3
    ],
    "aMails": [],
    "lat": null,
    "lng": null,
    "konumNot": ""
  },
  {
    "id": "c63",
    "name": "AKYAPAK ULUSLAR ARASI DIŞ TİC.MAK.SAN.TİC.A.Ş.",
    "bolge": "HOSAB",
    "techId": "t2",
    "email": "",
    "truck": false,
    "weeks": [
      1,
      2,
      3,
      4
    ],
    "aMails": [],
    "lat": null,
    "lng": null,
    "konumNot": ""
  },
  {
    "id": "c64",
    "name": "YAMAS YAŞAR MAKİNA KALIP OTO YEDEK PARÇA SAN.VE TİC.A.Ş.",
    "bolge": "",
    "techId": "t1",
    "email": "",
    "truck": false,
    "weeks": [
      2,
      4
    ],
    "aMails": [],
    "lat": null,
    "lng": null,
    "konumNot": ""
  },
  {
    "id": "c65",
    "name": "HİD-TEK MAKİNA SAN.TİC.LTD.ŞTİ.",
    "bolge": "OSB",
    "techId": "t2",
    "email": "",
    "truck": false,
    "weeks": [
      1,
      2
    ],
    "aMails": [],
    "lat": null,
    "lng": null,
    "konumNot": ""
  },
  {
    "id": "c66",
    "name": "NESTO MAKİNA MOBİLYA GIDA İNŞAAT VE İNŞAAT MALZEMELERİ SANAYİ İTHALAT İHRACAT LİMİTED ŞİRKETİ",
    "bolge": "İNEGÖL",
    "techId": "t1",
    "email": "",
    "truck": false,
    "weeks": [
      3
    ],
    "aMails": [],
    "lat": null,
    "lng": null,
    "konumNot": ""
  },
  {
    "id": "c67",
    "name": "EMEK ÖZEL CIVATA MAKİNA SAN. VE TIC. LTD. ŞTI.",
    "bolge": "ESKİŞEHİR",
    "techId": "t2",
    "email": "",
    "truck": false,
    "weeks": [
      1
    ],
    "aMails": [],
    "lat": null,
    "lng": null,
    "konumNot": ""
  },
  {
    "id": "c68",
    "name": "GÖKÇELİK ÇELİK EŞYA SAN.TİC.A.Ş.",
    "bolge": "",
    "techId": "t1",
    "email": "",
    "truck": false,
    "weeks": [
      2
    ],
    "aMails": [],
    "lat": null,
    "lng": null,
    "konumNot": ""
  },
  {
    "id": "c69",
    "name": "SED DİŞLİ MAKİNE SANAYİ VE TİCARET LTD ŞTİ",
    "bolge": "OSB",
    "techId": "t2",
    "email": "",
    "truck": false,
    "weeks": [
      1
    ],
    "aMails": [],
    "lat": null,
    "lng": null,
    "konumNot": ""
  },
  {
    "id": "c70",
    "name": "TEKNİK FREZE ALPHAN-ERHAN ERYÜKSEL ADI ORTAKLIĞI",
    "bolge": "BALIKESİR",
    "techId": "t1",
    "email": "",
    "truck": false,
    "weeks": [
      1
    ],
    "aMails": [],
    "lat": null,
    "lng": null,
    "konumNot": ""
  },
  {
    "id": "c71",
    "name": "KUTLUK DÖKÜM OTOMOTİV KALIP VE MAKİNE PARÇALARI SANAYİ VE TİCARET LİMİTED ŞİRKETİ",
    "bolge": "HOSAB",
    "techId": "t2",
    "email": "",
    "truck": false,
    "weeks": [
      1,
      3
    ],
    "aMails": [],
    "lat": null,
    "lng": null,
    "konumNot": ""
  },
  {
    "id": "c72",
    "name": "MAKSEL METAL KALIP OTOMOTİV YAN SANAYİ TİCARET LİMİTED ŞİRKETİ",
    "bolge": "ALTINOVA",
    "techId": "t4",
    "email": "",
    "truck": false,
    "weeks": [
      1
    ],
    "aMails": [],
    "lat": null,
    "lng": null,
    "konumNot": ""
  },
  {
    "id": "c73",
    "name": "ALPMAC TAKIM TEZGAHLARI MAK. SAN. VE TİC. A.Ş",
    "bolge": "KAYAPA",
    "techId": "t1",
    "email": "",
    "truck": false,
    "weeks": [
      2
    ],
    "aMails": [],
    "lat": null,
    "lng": null,
    "konumNot": ""
  },
  {
    "id": "c74",
    "name": "DEMİSAŞ",
    "bolge": "BİLECİK",
    "techId": "t2",
    "email": "",
    "truck": false,
    "weeks": [
      1,
      2,
      3,
      4
    ],
    "aMails": [],
    "lat": null,
    "lng": null,
    "konumNot": ""
  },
  {
    "id": "c75",
    "name": "ADARAD DÖKÜM ÜRÜNLERİ SAN VE TİC A.Ş",
    "bolge": "İNEGÖL",
    "techId": "t1",
    "email": "",
    "truck": false,
    "weeks": [
      2,
      3
    ],
    "aMails": [],
    "lat": null,
    "lng": null,
    "konumNot": ""
  },
  {
    "id": "c76",
    "name": "TOYO OTO YEDEK PARÇA VE METAL SANAYİ TİCARET PAZARLAMA LİMİTED ŞİRKETİ",
    "bolge": "KAYAPA",
    "techId": "t2",
    "email": "",
    "truck": false,
    "weeks": [
      1
    ],
    "aMails": [],
    "lat": null,
    "lng": null,
    "konumNot": ""
  },
  {
    "id": "c77",
    "name": "CANEL OTOMOTİV SAN. VE TİC. A.Ş.",
    "bolge": "HOSAB",
    "techId": "t2",
    "email": "",
    "truck": false,
    "weeks": [
      1,
      2,
      3,
      4
    ],
    "aMails": [],
    "lat": null,
    "lng": null,
    "konumNot": ""
  },
  {
    "id": "c78",
    "name": "YARIŞ OTO BURSA",
    "bolge": "",
    "techId": "t1",
    "email": "",
    "truck": false,
    "weeks": [
      1,
      2,
      3,
      4
    ],
    "aMails": [],
    "lat": null,
    "lng": null,
    "konumNot": ""
  },
  {
    "id": "c79",
    "name": "DİŞLİ MAKİNA SAN. VE TİC.LTD.ŞTİ.",
    "bolge": "",
    "techId": "t2",
    "email": "",
    "truck": false,
    "weeks": [
      1,
      2,
      3,
      4
    ],
    "aMails": [],
    "lat": null,
    "lng": null,
    "konumNot": ""
  },
  {
    "id": "c80",
    "name": "ODOKSAN MAKİNA SAN. VE TİC. LTD. ŞTİ.",
    "bolge": "",
    "techId": "t2",
    "email": "",
    "truck": false,
    "weeks": [
      1,
      2,
      3,
      4
    ],
    "aMails": [],
    "lat": null,
    "lng": null,
    "konumNot": ""
  }
];
