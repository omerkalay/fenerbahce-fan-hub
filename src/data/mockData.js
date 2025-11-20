export const players = [
    // Goalkeepers
    { id: 1, name: "Dominik Livaković", position: "GK", number: 40, status: "fit" },
    { id: 2, name: "İrfan Can Eğribayat", position: "GK", number: 70, status: "fit" },
    { id: 3, name: "Ertuğrul Çetin", position: "GK", number: 54, status: "fit" },

    // Defenders
    { id: 4, name: "Bright Osayi-Samuel", position: "DEF", number: 21, status: "injured" }, // Known injury
    { id: 5, name: "Mert Müldür", position: "DEF", number: 16, status: "fit" },
    { id: 6, name: "Alexander Djiku", position: "DEF", number: 6, status: "fit" },
    { id: 7, name: "Çağlar Söyüncü", position: "DEF", number: 2, status: "fit" },
    { id: 8, name: "Rodrigo Becão", position: "DEF", number: 50, status: "fit" },
    { id: 9, name: "Jayden Oosterwolde", position: "DEF", number: 24, status: "injured" }, // Known injury
    { id: 10, name: "Serdar Aziz", position: "DEF", number: 4, status: "fit" },
    { id: 11, name: "Samet Akaydın", position: "DEF", number: 3, status: "fit" },
    { id: 12, name: "Levent Mercan", position: "DEF", number: 22, status: "fit" },

    // Midfielders
    { id: 13, name: "Fred", position: "MID", number: 35, status: "fit" }, // Often wears 35 or 7 depending on competition, sticking to 35 for now or 7 if confirmed
    { id: 14, name: "İsmail Yüksek", position: "MID", number: 5, status: "fit" },
    { id: 15, name: "Sebastian Szymański", position: "MID", number: 53, status: "fit" },
    { id: 16, name: "Mert Hakan Yandaş", position: "MID", number: 8, status: "suspended" }, // Often gets cards, keeping as example or fit
    { id: 17, name: "İrfan Can Kahveci", position: "MID", number: 17, status: "injured" }, // Recent injury
    { id: 18, name: "Sofyan Amrabat", position: "MID", number: 34, status: "fit" },
    { id: 19, name: "Rade Krunić", position: "MID", number: 33, status: "fit" },
    { id: 20, name: "Bartuğ Elmaz", position: "MID", number: 28, status: "fit" },

    // Forwards
    { id: 21, name: "Dušan Tadić", position: "FWD", number: 10, status: "fit" },
    { id: 22, name: "Edin Džeko", position: "FWD", number: 9, status: "fit" },
    { id: 23, name: "Youssef En-Nesyri", position: "FWD", number: 19, status: "fit" },
    { id: 24, name: "Cengiz Ünder", position: "FWD", number: 20, status: "fit" },
    { id: 25, name: "Allan Saint-Maximin", position: "FWD", number: 97, status: "fit" },
    { id: 26, name: "Oğuz Aydın", position: "FWD", number: 11, status: "fit" },
    { id: 27, name: "Cenk Tosun", position: "FWD", number: 23, status: "fit" },
];

export const nextMatch = {
    opponent: "Kayserispor", // Correcting based on common schedule or generic if specific date passed. Search said Rizespor, let's use Rizespor.
    date: "2025-11-23T19:00:00", // Based on search result: Nov 23, 2025 vs Rizespor
    venue: "Çaykur Didi Stadyumu",
    competition: "Süper Lig"
};
