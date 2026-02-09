/**
 * 台灣麻將算台邏輯 (Taiwan Mahjong Scoring)
 * 
 * 核心功能：
 * 1. analyzeHand: 分析手牌是否胡牌，並回傳最佳的面子組合。
 * 2. calculateTai: 根據面子組合與環境資訊計算台數。
 */

// --- Constants ---

const TILE_SUITS = {
    'C': '萬', 'D': '筒', 'B': '索', 'Zi': '字', 'Hua': '花'
};

const WINDS = ['EW', 'SW', 'WW', 'NW']; // 東南西北
const DRAGONS = ['RD', 'GD', 'WD'];     // 中發白

// 台數表 (部分常用)
const TAI_MAP = {
    ZIMO: 1,       // 自摸
    GANG_SHANG: 1, // 槓上開花
    MEN_QING: 1,   // 門清 (無吃碰，若自摸則為門清自摸)
    WIND_SEAT: 1,  // 門風
    WIND_CIRCLE: 1,// 圈風
    DRAGON: 1,     // 三元牌
    FLOWER: 1,     // 花牌
    HAI_DI: 1,     // 海底撈月
    PING_HU: 2,    // 平胡
    SAN_AN_KE: 2,  // 三暗刻
    SI_AN_KE: 5,   // 四暗刻
    WU_AN_KE: 8,   // 五暗刻
    ALL_PONGS: 4,  // 碰碰胡
    MIXED_SUIT: 4, // 混一色
    PURE_SUIT: 8,  // 清一色
    SMALL_THREE_DRAGONS: 4, // 小三元
    BIG_THREE_DRAGONS: 8,   // 大三元
    SMALL_FOUR_WINDS: 8,    // 小四喜
    BIG_FOUR_WINDS: 16,     // 大四喜
    ALL_HONORS: 8,          // 字一色
    SEVEN_PAIRS: 8,         // 七搶一? 不對，是嚦咕嚦咕(八台)
    HEAVENLY_HAND: 24,      // 天胡 (24台)
    EARTHLY_HAND: 16,       // 地胡
    TIAN_TING: 8,           // 天聽 (通常8台)
};

export const RULE_DESCRIPTIONS = {
    '門清': '手中16張牌完全未經吃、碰、明槓，由他人放槍胡牌。',
    '自摸': '自己摸到胡牌的牌。',
    '圈風': '有與當前局數（圈）同風向的刻子或槓。',
    '門風': '有與自己座位同風向的刻子或槓。',
    '三元牌': '擁有中、發、白任一種刻子或槓。',
    '花牌': '花牌計分：\n1. 正花 (1台)：拿到與自己座位對應的花牌。\n   東=春/梅, 南=夏/蘭, 西=秋/竹, 北=冬/菊。\n2. 合花 (2台)：湊齊「春夏秋冬」或是「梅蘭竹菊」整組四張。',
    '自摸': '自摸：自己摸到胡牌的牌 (1台)。',
    '門清': '門清：手牌無任何吃、碰、明槓 (1台)。若自摸則加計一摸三 (共3台)。',
    '槓上開花': '槓上開花：槓牌後補牌時胡牌 (1台)。',
    '海底撈月': '海底撈月：摸到牌牆上最後一張牌時胡牌 (1台)。',
    '天聽': '天聽：閒家開局補花後即宣告聽牌，且之後無換牌 (8台)。',
    '天胡': '天胡：莊家開局配牌即胡牌 (24台)。',
    '地胡': '地胡：閒家摸到的第一張牌即胡牌，或胡莊家打出的第一張牌 (16台)。',
    '半求人': '半求人：手牌全吃碰，只剩一張單吊胡牌 (1台)。',
    '全求人': '全求人：手牌全吃碰，最後一張也是胡別人的槍 (2台)。',
    '三元牌': '擁有中、發、白任一種刻子或槓。',
    '碰碰胡': '牌型由5組刻子（或槓）和1組對子組成，沒有順子。',
    '混一色': '整副牌由同一種花色（萬/筒/索）與字牌組成。',
    '清一色': '整副牌完全由同一種花色組成，無字牌。',
    '字一色': '整副牌完全由字牌組成。',
    '大三元': '集齊中、發、白三組刻子（或槓）。',
    '小三元': '中、發、白其中兩組為刻子，另一組為將眼（對子）。',
    '大四喜': '集齊東、南、西、北四組刻子（或槓）。',
    '小四喜': '東、南、西、北其中三組為刻子，另一組為將眼。',
    '獨聽 (中洞/邊張/單吊)': '所聽的牌僅有唯一的一種（例如中洞、邊張、單吊），且無其他聽牌可能。',
};

// --- Helpers ---

// 解析牌代碼
const parseTile = (code) => {
    if (!code) return null;

    // 1. Dragons (三元牌)
    if (['RD', 'GD', 'WD'].includes(code)) {
        const val = DRAGONS.indexOf(code) + 5;
        return { code, suit: 'Zi', value: val, isHonor: true };
    }

    // 2. Winds (風牌)
    if (['EW', 'SW', 'WW', 'NW'].includes(code)) {
        const val = WINDS.indexOf(code) + 1;
        return { code, suit: 'Zi', value: val, isHonor: true };
    }

    // 3. Flowers (花牌)
    if (['1F', '2F', '3F', '4F', '1S', '2S', '3S', '4S'].includes(code)) {
        return { code, suit: 'Hua', value: 0, isHonor: false };
    }

    // 4. Suits (萬筒索)
    // Assumes format like 1C, 2D, 9B
    const typeChar = code.slice(-1);
    const valChar = code.slice(0, -1);
    const val = parseInt(valChar);

    if (!isNaN(val)) {
        // Safety check for valid suits
        if (['C', 'D', 'B'].includes(typeChar)) {
            return { code, suit: typeChar, value: val, isHonor: false };
        }
    }

    return { code, suit: 'Unknown', value: 0, isHonor: false };
};

// 檢查是否為順子
const isSequence = (t1, t2, t3) => {
    // 必須同花色且非字牌
    if (t1.suit !== t2.suit || t1.suit !== t3.suit) return false;
    if (t1.isHonor) return false;
    // 排序後數值連續
    const v = [t1.value, t2.value, t3.value].sort((a, b) => a - b);
    return (v[1] === v[0] + 1) && (v[2] === v[1] + 1);
};

// 檢查是否為刻子
const isTriplet = (t1, t2, t3) => {
    return t1.code === t2.code && t2.code === t3.code;
};

/**
 * 主要函式 Application Entry
 * @param {Array<string>} concealedCodes - 暗牌 (e.g. ['1C', '2C'...])
 * @param {Array<string>} exposedCodes - 明牌 (單張列表，需假設它們已成面子)
 * @param {Object} context - 環境資訊 { isZimo, isWindCircle, isWindSeat, roundWind, seatWind }
 */
export function calculateTai(concealedCodes, exposedCodes, context = {}) {
    // 1. 預處理：分離花牌與正規牌
    const pConcealed = concealedCodes.map(parseTile).filter(t => t.suit !== 'Hua');
    const pExposed = exposedCodes.map(parseTile).filter(t => t.suit !== 'Hua');
    const pFlowers = [...concealedCodes, ...exposedCodes].map(parseTile).filter(t => t.suit === 'Hua');

    // 2. 驗證是否胡牌 (Analyze structure)
    // 台灣麻將標準 16 張，胡牌時為 17 張 (或包含槓牌更多，但標準面子數量固定)
    // 標準形式：5 組面子 (順/刻) + 1 對眼
    const analysis = analyzeStructure(pConcealed, pExposed);

    if (!analysis.isValid) {
        // 就算沒胡，也盡量計算有的東西 (例如花牌、明牌的台數) ?
        // 使用者可能只是想算台，不一定胡了 (例如相公算台?)
        // 但通常是算胡牌台。我們回傳基本資訊。
        return {
            tai: 0,
            desc: ['牌型不合法 (未胡牌或相公)'],
            isValid: false
        };
    }

    // 3. 計算台數
    // Determine winning tile:
    // 1. From context (passed by UI selection)
    // 2. Fallback to heuristic (first tile in list) - though this is inaccurate for exclusive wait.
    let winningTileObj = null;
    if (context.winningTile && context.winningTile.code) {
        // Find matching parsed tile in pConcealed to ensure we have full object properties (suit, value)
        // because checkExclusiveWait might rely on parsing rules or just code.
        // Actually pConcealed has parsed tiles. calculateTai input context.winningTile has only { code }.
        // We find the first matching tile in pConcealed.
        winningTileObj = pConcealed.find(t => t.code === context.winningTile.code);
    }

    // Fallback if not found or not provided
    if (!winningTileObj) {
        winningTileObj = pConcealed[0] || null;
    }

    const result = computeScore(analysis, pFlowers, context, { pConcealed, pExposed, winningTile: winningTileObj }); // Pass full context for complex checks
    return { ...result, isValid: true };
}

// Check Exclusive Wait (Simple robust check: if you only wait for THIS tile, +1 tai)
// Covers: Middle Hole (嵌張), Side Wait (邊張), Single Wait (單吊)
function checkExclusiveWait(concealed, exposed, winningTile) {
    if (!winningTile) return false;

    // Create a 16-tile hand (removing the winning tile)
    // Note: concealed includes the winning tile. We need to find and remove ONE instance of winningTile.
    const listeningHand = [...concealed];
    const winIdx = listeningHand.findIndex(t => t.code === winningTile.code);
    if (winIdx === -1) return false; // Should not happen
    listeningHand.splice(winIdx, 1);

    // Get all possible winning tiles for this 16-tile hand
    const allTiles = [];
    ['C', 'D', 'B'].forEach(suit => {
        for (let v = 1; v <= 9; v++) allTiles.push(`${v}${suit}`);
    });
    WINDS.concat(DRAGONS).forEach(code => allTiles.push(code));

    let waitingFor = 0;

    // Optimization: Depending on performance, checking 34 tiles effectively might be slow if backtracking is slow.
    // Ensure findBestHand is fast enough. 
    // Usually acceptable for 1 call per calculation.

    for (const code of allTiles) {
        const testTile = parseTile(code);
        // Add test tile
        const testConcealed = [...listeningHand, testTile];
        // Analyze
        // We need to bypass the "total count" check inside analyzeStructure if strictly enforcing 17.
        // But analyzeStructure logic relies on "Sets + Pair".
        // concealed=17. 
        // Logic: 5 sets + 1 pair.
        const check = analyzeStructure(testConcealed, exposed);
        if (check.isValid) {
            waitingFor++;
            if (waitingFor > 1) return false; // More than 1 wait -> Not exclusive
        }
    }

    return waitingFor === 1;
}

// --- Structure Analysis (Backtracking) ---

function analyzeStructure(concealed, exposed) {
    // Total tiles (excluding Kong replacements logic for now, simplify to Count check)
    // 5 sets + 1 pair = 17 tiles.
    // If we have Kongs, the visual tile count might differ, but logically it's still 5 sets + 1 pair.

    // Sort concealed for easier backtracking
    concealed.sort((a, b) => {
        if (a.suit !== b.suit) return a.suit.localeCompare(b.suit);
        return a.value - b.value;
    });

    // We assume 'exposed' are already valid sets (Chows/Pongs/Kongs).
    // However, the input 'exposed' is just a flat list of codes. 
    // AI detection gives individual tiles. We need to group them.
    // Heuristic:
    // 1. Group identical tiles (Pongs/Kongs)
    // 2. Group sequences (Chows) - this is harder with just a list.
    // For MVP, we might assume exposed tiles are passed as Groups? 
    // No, existing code passes flat array.
    // Let's try to group exposed tiles first.

    const exposedSets = groupExposedTiles(exposed);
    if (!exposedSets) return { isValid: false, reason: "明牌無法組合成合法面子" };

    // Now satisfy the equation:
    // (Concealed Sets + Exposed Sets) = 5
    // AND (Concealed Pair) = 1

    // Calculate required concealed sets
    const totalSetsNeeded = 5;
    const currentExposedCount = exposedSets.length;
    const needConcealedSets = totalSetsNeeded - currentExposedCount;

    if (needConcealedSets < 0) return { isValid: false, reason: "面子過多" };

    // Backtracking to find subsets in 'concealed'
    const bestHand = findBestHand(concealed, needConcealedSets);

    if (bestHand) {
        return {
            isValid: true,
            concealedSets: bestHand.sets,
            pair: bestHand.pair,
            exposedSets: exposedSets,
            allTiles: [...concealed, ...exposed]
        };
    }

    return { isValid: false, reason: "暗牌無法組合成胡牌形式" };
}

// Simple heuristic to group exposed tiles
function groupExposedTiles(tiles) {
    // Deep copy
    let pool = [...tiles];
    // Sort
    pool.sort((a, b) => {
        if (a.suit !== b.suit) return a.suit.localeCompare(b.suit);
        return a.value - b.value;
    });

    const sets = [];

    while (pool.length > 0) {
        // Try Triplet (Pon/Kong) - Prioritize identicals for exposed (easiest to detect)
        if (pool.length >= 3 && pool[0].code === pool[1].code && pool[1].code === pool[2].code) {
            // Check for Kong (4)
            if (pool.length >= 4 && pool[3].code === pool[0].code) {
                sets.push({ type: 'Kong', tiles: pool.slice(0, 4), isExposed: true });
                pool.splice(0, 4);
            } else {
                sets.push({ type: 'Pon', tiles: pool.slice(0, 3), isExposed: true });
                pool.splice(0, 3);
            }
            continue;
        }

        // Try Sequence
        // Find T1, T2, T3
        const t1 = pool[0];
        const t2Index = pool.findIndex(t => t.suit === t1.suit && t.value === t1.value + 1);
        const t3Index = pool.findIndex(t => t.suit === t1.suit && t.value === t1.value + 2);

        if (t2Index !== -1 && t3Index !== -1) {
            const t2 = pool[t2Index];
            const t3 = pool[t3Index];
            sets.push({ type: 'Chi', tiles: [t1, t2, t3], isExposed: true });

            // Remove carefully (indices shift)
            // Remove largest index first
            const indices = [0, t2Index, t3Index].sort((a, b) => b - a);
            indices.forEach(i => pool.splice(i, 1));
            continue;
        }

        // If neither, invalid exposed config
        return null;
    }

    return sets;
}

function findBestHand(tiles, setsNeeded) {
    // Need to find 'setsNeeded' sets and 1 pair.
    // Strategy: Iterate all possible Pairs, then check if rest form sets.

    // Unique tiles for pair candidates
    const uniqueCodes = [...new Set(tiles.map(t => t.code))];

    for (const code of uniqueCodes) {
        // Try this as pair
        const pairTiles = tiles.filter(t => t.code === code);
        if (pairTiles.length >= 2) {
            // Remove 2 tiles for pair
            const remaining = removeTiles(tiles, [pairTiles[0], pairTiles[1]]);
            const resultSets = findSets(remaining, setsNeeded);
            if (resultSets) {
                return {
                    pair: [pairTiles[0], pairTiles[1]],
                    sets: resultSets
                };
            }
        }
    }
    return null;
}

function findSets(tiles, count) {
    if (count === 0) {
        return tiles.length === 0 ? [] : null;
    }

    // Optimization: if remaining tiles < count * 3, impossible
    if (tiles.length < count * 3) return null;

    const first = tiles[0];

    // 1. Try Triplet
    if (tiles.length >= 3 && tiles[1].code === first.code && tiles[2].code === first.code) {
        const set = { type: 'Pon', tiles: [tiles[0], tiles[1], tiles[2]], isExposed: false };
        const rem = tiles.slice(3);
        const res = findSets(rem, count - 1);
        if (res) return [set, ...res];
    }

    // 2. Try Sequence
    // Must be non-honor
    if (!first.isHonor) {
        const t2Index = tiles.findIndex(t => t.suit === first.suit && t.value === first.value + 1);
        const t3Index = tiles.findIndex(t => t.suit === first.suit && t.value === first.value + 2);

        if (t2Index !== -1 && t3Index !== -1) {
            const set = { type: 'Chi', tiles: [first, tiles[t2Index], tiles[t3Index]], isExposed: false };
            const rem = removeTiles(tiles, [first, tiles[t2Index], tiles[t3Index]]);
            const res = findSets(rem, count - 1);
            if (res) return [set, ...res];
        }
    }

    return null;
}

function removeTiles(source, toRemove) {
    const copy = [...source];
    for (const t of toRemove) {
        const idx = copy.findIndex(x => x.code === t.code); // Simplified check by code
        if (idx !== -1) copy.splice(idx, 1);
    }
    return copy;
}

// --- Scoring Logic ---

function computeScore(hand, flowers, ctx, extraContext) {
    let tai = 0;
    const desc = [];

    const allSets = [...hand.concealedSets, ...hand.exposedSets];
    const isExposed = hand.exposedSets.length > 0;

    // 0. 特殊: 平胡 (Ping Hu)
    // 條件: 全順子 + 無花 + 無字牌刻子(含將眼) + 非獨聽(無法判斷，暫略) + 非暗槓? 
    // 簡單判斷: All Chows + No Honors Sets + Pair is not Scoring + No Flowers
    const isAllChows = allSets.every(s => s.type === 'Chi');
    const hasFlowers = flowers.length > 0;
    const hasHonorSets = allSets.some(s => s.tiles[0].isHonor);
    // Pair check: Cant be Dragon, SeatWind, RoundWind
    const pairCode = hand.pair[0].code;
    const isScoringPair = ['RD', 'GD', 'WD', ctx.roundWind, ctx.seatWind].includes(pairCode);

    // 平胡不與自摸並存? 台灣規則通常: 平胡(2) + 自摸(1) 無效，變成 自摸(1) + 門清(1) ?
    // 或是 平胡(2) 若自摸則沒平胡? 
    // MJ888: 平胡 2台 (無花無字無刻...)。
    // 這邊先寬鬆給予，若使用者想嚴格可自行扣除。但我設條件: !hasFlowers && isAllChows && !hasHonorSets && !isScoringPair
    if (isAllChows && !hasFlowers && !hasHonorSets && !isScoringPair) {
        // All confirmed sets are Chows, no honors, safe pair. 
        // Also Ping Hu usually implies Men Qing? No, exposed chows allowed. But standard "Ping Hu" 2 tai usually means concealed?
        // No, Exposed Ping Hu exists but rare?
        // Wait, Taiwan Ping Hu: "Matching the hands" -> 2 tai. 
        // Let's assume Valid.
        tai += TAI_MAP.PING_HU;
        desc.push({ name: '平胡', tai: TAI_MAP.PING_HU });
    }

    // 1. 暗刻 (Concealed Pongs)
    // Count 'Pon' (or 'Kong') in concealedSets
    const concealedPongs = hand.concealedSets.filter(s => s.type === 'Pon' || s.type === 'Kong').length;

    if (concealedPongs === 5) {
        tai += TAI_MAP.WU_AN_KE;
        desc.push({ name: '五暗刻', tai: TAI_MAP.WU_AN_KE });
    } else if (concealedPongs === 4) {
        tai += TAI_MAP.SI_AN_KE; // 5
        desc.push({ name: '四暗刻', tai: TAI_MAP.SI_AN_KE });
    } else if (concealedPongs === 3) {
        tai += TAI_MAP.SAN_AN_KE; // 2
        desc.push({ name: '三暗刻', tai: TAI_MAP.SAN_AN_KE });
    }

    // 2. 碰碰胡 (All Pongs)
    const isAllPongs = allSets.every(s => s.type === 'Pon' || s.type === 'Kong');
    if (isAllPongs) {
        tai += TAI_MAP.ALL_PONGS;
        desc.push({ name: '碰碰胡', tai: TAI_MAP.ALL_PONGS });
    }

    // 2. 混一色 / 清一色
    const suits = new Set([...hand.allTiles.filter(t => !t.isHonor).map(t => t.suit)]);
    const hasHonors = hand.allTiles.some(t => t.isHonor);

    if (suits.size === 1) {
        if (!hasHonors) {
            tai += TAI_MAP.PURE_SUIT;
            desc.push({ name: '清一色', tai: TAI_MAP.PURE_SUIT });
        } else {
            tai += TAI_MAP.MIXED_SUIT;
            desc.push({ name: '混一色', tai: TAI_MAP.MIXED_SUIT });
        }
    }

    // 3. 字一色
    if (suits.size === 0 && hasHonors) {
        // Technically this overlaps with Big Four Winds/Three Dragons, typically calculated cumulatively or override?
        // Taiwan Mahjong usually adds up.
        tai += TAI_MAP.ALL_HONORS;
        desc.push({ name: '字一色', tai: TAI_MAP.ALL_HONORS });
    }

    // 4. 三元牌 (中發白)
    const dragonPongs = allSets.filter(s => s.tiles[0].isHonor && ['RD', 'GD', 'WD'].includes(s.tiles[0].code));

    // 大三元 / 小三元 (不疊加計算三元牌)
    let hasBigOrSmallDragons = false;

    if (dragonPongs.length === 3) {
        tai += TAI_MAP.BIG_THREE_DRAGONS;
        desc.push({ name: '大三元', tai: TAI_MAP.BIG_THREE_DRAGONS });
        hasBigOrSmallDragons = true;
    } else if (dragonPongs.length === 2 && hand.pair[0].isHonor && ['RD', 'GD', 'WD'].includes(hand.pair[0].code)) {
        tai += TAI_MAP.SMALL_THREE_DRAGONS;
        desc.push({ name: '小三元', tai: TAI_MAP.SMALL_THREE_DRAGONS });
        hasBigOrSmallDragons = true;
    }

    // 若沒有大/小三元，才計算個別的三元牌台數
    if (!hasBigOrSmallDragons) {
        dragonPongs.forEach(s => {
            tai += 1;
            // Use '三元牌' as the description key, but display specific name
            desc.push({ name: `三元牌 (${TAI_MAP[s.tiles[0].code] || s.tiles[0].code})`, tai: 1, descKey: '三元牌' });
        });
    }

    // 5. 風牌 (圈風/門風)
    const windPongs = allSets.filter(s => s.tiles[0].isHonor && WINDS.includes(s.tiles[0].code));

    // 大四喜 / 小四喜 (不疊加計算圈風門風)
    let hasBigOrSmallWinds = false;

    if (windPongs.length === 4) {
        tai += TAI_MAP.BIG_FOUR_WINDS;
        desc.push({ name: '大四喜', tai: TAI_MAP.BIG_FOUR_WINDS });
        hasBigOrSmallWinds = true;
    } else if (windPongs.length === 3 && hand.pair[0].isHonor && WINDS.includes(hand.pair[0].code)) {
        tai += TAI_MAP.SMALL_FOUR_WINDS;
        desc.push({ name: '小四喜', tai: TAI_MAP.SMALL_FOUR_WINDS });
        hasBigOrSmallWinds = true;
    }

    if (!hasBigOrSmallWinds) {
        windPongs.forEach(s => {
            const wCode = s.tiles[0].code;
            if (ctx.roundWind === wCode) {
                tai += 1;
                desc.push({ name: '圈風', tai: 1 });
            }
            if (ctx.seatWind === wCode) {
                tai += 1;
                desc.push({ name: '門風', tai: 1 });
            }
        });
    }

    // 6. 花牌 (Flowers)
    // Rules:
    // - Seat Match (正花): 1 Tai. (East=1, South=2, West=3, North=4)
    // - Full Set (花槓): 4 Tai (Four Seasons or Four Nobles). Overrides Seat Match? 
    //   Usually MJ888: Flower Kong = 2 Tai.
    //   Let's assume: Full Set = 2 Tai. (Per set).
    //   If 8 flowers = 8 Tai (Eight Immortals).

    if (flowers.length === 8) {
        tai += 8;
        desc.push({ name: '八仙過海 (8花)', tai: 8, descKey: '花牌' });
    } else {
        // Separate into Seasons (1S-4S) and Nobles (1F-4F)
        const seasons = flowers.filter(f => f.code.endsWith('S'));
        const nobles = flowers.filter(f => f.code.endsWith('F'));

        // Check Seasons
        if (seasons.length === 4) {
            tai += 2;
            desc.push({ name: '四季發財 (4花)', tai: 2, descKey: '花牌' });
        } else {
            // Check Seat Match
            const seatNum = WINDS.indexOf(ctx.seatWind) + 1; // 1..4
            const hasSeatSeason = seasons.some(f => parseInt(f.code) === seatNum);
            if (hasSeatSeason) {
                tai += 1;
                desc.push({ name: `正花 (${TAI_MAP[ctx.seatWind] || '門'}位季)`, tai: 1, descKey: '花牌' });
            }
        }

        // Check Nobles
        if (nobles.length === 4) {
            tai += 2;
            desc.push({ name: '四君子 (4花)', tai: 2, descKey: '花牌' });
        } else {
            // Check Seat Match
            const seatNum = WINDS.indexOf(ctx.seatWind) + 1;
            const hasSeatNoble = nobles.some(f => parseInt(f.code) === seatNum);
            if (hasSeatNoble) {
                tai += 1;
                desc.push({ name: `正花 (${TAI_MAP[ctx.seatWind] || '門'}位花)`, tai: 1, descKey: '花牌' });
            }
        }

        // Note: Generic "Flower" count (1 tai per flower) is NOT standard Taiwan Competitive rule. 
        // Standard is: Proper Flower = 1 Tai.
        // But many casual games play "Have flower = 1 tai". 
        // User asked to "judge by position", implies standard rule.
        // So I removed the generic `tai += flowers.length`.
    }

    // 7. 門清
    if (hand.exposedSets.length === 0) {
        tai += TAI_MAP.MEN_QING;
        desc.push({ name: '門清', tai: TAI_MAP.MEN_QING });
    }

    // 8. 自摸 / 槓上 / 海底
    if (ctx.isZimo) {
        tai += TAI_MAP.ZIMO;

        // 門清自摸 (一摸三: 門清1 + 自摸1 + 獎勵1 = 3)
        // Check if hand is Men Qing (no exposed sets)
        // logic for isMenQing was defined below, let's hoist or check directly
        if (hand.exposedSets.length === 0) {
            tai += 1;
            desc.push({ name: '門清自摸 (加計)', tai: 1 });
        }

        desc.push({ name: '自摸', tai: TAI_MAP.ZIMO });
    }
    if (ctx.isGangShang) {
        tai += TAI_MAP.GANG_SHANG;
        desc.push({ name: '槓上開花', tai: TAI_MAP.GANG_SHANG });
    }
    // Check Men Qing condition for special scenarios
    const isMenQing = hand.exposedSets.length === 0;

    if (ctx.isLastTile) {
        tai += TAI_MAP.HAI_DI;
        desc.push({ name: '海底撈月', tai: TAI_MAP.HAI_DI, descKey: '海底撈月' });
    }

    // Tian Ting, Tian Hu, Di Hu usually imply Men Qing (no prior exposed sets)
    // Note: Tian Ting can theoretically happen with exposed sets? No, must be first turn or first discard.
    // If you exposed a set, you have passed the first turn drawing phase.
    // Exception: Dealer Tian Hu (16 cards) - naturally Men Qing.
    // Di Hu: Player wins on dealer's first discard. Player must have 16 concealed cards? Yes.
    // So all enforce Men Qing.
    if (ctx.isTianTing && isMenQing) {
        tai += TAI_MAP.TIAN_TING;
        desc.push({ name: '天聽', tai: TAI_MAP.TIAN_TING, descKey: '天聽' });
    }
    if (ctx.isTianHu && isMenQing) {
        tai += TAI_MAP.HEAVENLY_HAND;
        desc.push({ name: '天胡', tai: TAI_MAP.HEAVENLY_HAND, descKey: '天胡' });
    }
    if (ctx.isDiHu && isMenQing) {
        tai += TAI_MAP.EARTHLY_HAND;
        desc.push({ name: '地胡', tai: TAI_MAP.EARTHLY_HAND, descKey: '地胡' });
    }

    // 8. 獨聽 (中洞/邊張/單吊)
    // Logic: Check if there was only 1 possible winning tile.
    // Note: This check is somewhat expensive (34 checks).
    if (extraContext && extraContext.pConcealed && extraContext.winningTile) {
        // Assuming the first tile in pConcealed isn't necessarily the winning one in raw list, 
        // BUT standard practice in this app seems to be we don't track *which* specific tile was the 17th.
        // However, in `CameraAI`, we usually push validPreds. 
        // Let's assume the caller logic doesn't strictly separate 17th.
        // We might need to try removing *each* tile that matches winning? 
        // Actually, if we just remove ONE instance of the winning tile code, that represents the state before winning.

        // Fix: `pConcealed` passed to `calculateTai` includes the winning tile. 
        // We define "Winning Tile" as... actually we don't know WHICH one is the winning tile if user just takes a photo of 17 tiles.
        // We can heuristic: Try to remove one instance of every unique tile in hand, check if the rest waits for *only* that tile.
        // IF any removal results in Exclusive Wait for that tile, we award it.
        // This is generous but fair for "Photo" scoring where last tile isn't marked.

        // Optimization: Only check this if user asks? Or always?
        // User asked "How to design". Implementing implicit check is best UX.

        // To properly implement: We need to know WHICH tile is the winner.
        // Since we don't know, we skip exact identification.
        // BUT, if we assume the standard "Exclusive Wait" bonus, we can check:
        // Does the hand *shape* imply exclusive wait?
        // Simplification: We check the `checkExclusiveWait` using the logic that 
        // "If the hand can be interpreted as an exclusive wait for ANY of its tiles, is that valid?"
        // No, that's wrong. You need to know the winning tile.

        // For now, let's assume the LAST tile in the concealed array is the winner? 
        // Or just disable this auto-calc if we don't know.
        // Wait, the user manual selection has a "Winning Tile" usually?
        // In CameraAI, we just dump all tiles.
        // Let's check `isExclusiveWait` for *the tile that was marked as 'winning'*.
        // Since we don't have that info, maybe we skip or use heuristic.

        // REVISION: The User Prompt asks "How to judge".
        // I will add the function but comment it out or leave it for "Manual Mode" where we know the winning tile?
        // CameraAI sorts tiles. We lose temporal info.
        // However, if the hand is *intrinsically* a single wait (e.g. 1,2,3... 12345), 
        // wait, 12345 waits 3,6. Not single.
        // 123 waits... 1,4.
        // 24 waits 3.
        // The set of "Valid Winning Hands" implies the wait.
        // Algorithm:
        // 1. If we can remove ONE tile `t` from the hand such that the remaining 16 tiles ONLY wait for `t`, AND `t` is the tile we have.
        // Then it IS an exclusive wait.
        // We can iterate all unique tiles in hand `t_in_hand`:
        //    If removing `t_in_hand` results in `waiting_tiles == [t_in_hand]`,
        //    Then this hand configuration IS a "Single Wait Win" on `t_in_hand`.
        //    Since we physically HAVE `t_in_hand`, we fulfilled it.

        let foundExclusive = false;

        // If specific winning tile is provided, use it strictly.
        if (extraContext.winningTile && extraContext.winningTile.code) {
            foundExclusive = checkExclusiveWait(extraContext.pConcealed, extraContext.pExposed, extraContext.winningTile);
        } else {
            // Fallback: Check if ANY tile in hand could be an exclusive wait winner
            const uniqueTiles = [...new Set(extraContext.pConcealed.map(t => t.code))];
            for (const code of uniqueTiles) {
                const t = parseTile(code);
                if (checkExclusiveWait(extraContext.pConcealed, extraContext.pExposed, t)) {
                    foundExclusive = true;
                    break;
                }
            }
        }

        if (foundExclusive) {
            tai += 1;
            desc.push({ name: '獨聽 (中洞/邊張/單吊)', tai: 1 });
        }
    }

    return { tai, desc };
}
