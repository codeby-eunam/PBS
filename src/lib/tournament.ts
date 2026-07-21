export type TournamentBracket = {
  remaining: string[];
  advancing: string[];
};

export function shuffleTournament(ids: string[], random = Math.random) {
  const shuffled = [...ids];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex],
      shuffled[index],
    ];
  }
  return shuffled;
}

export function advanceTournament(
  bracket: TournamentBracket,
  winnerId: string,
  random = Math.random,
): TournamentBracket {
  const currentMatch = bracket.remaining.slice(0, 2);
  if (currentMatch.length < 2 || !currentMatch.includes(winnerId)) {
    return bracket;
  }

  const remaining = bracket.remaining.slice(2);
  const advancing = [...bracket.advancing, winnerId];

  if (remaining.length >= 2) return { remaining, advancing };

  // An unmatched vendor receives a bye into the next round.
  if (remaining.length === 1) advancing.push(remaining[0]);

  if (advancing.length === 1) {
    return { remaining: advancing, advancing: [] };
  }

  return { remaining: shuffleTournament(advancing, random), advancing: [] };
}
