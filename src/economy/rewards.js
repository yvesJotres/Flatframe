/**
 * Mission rewards, from the Warframe wiki's Credit Reward rule:
 *
 *   Credit Reward = 1000 + 100 x (Minimum Enemy Level - 1) + Additional Credit Reward
 *
 * "Minimum Enemy Level" is the starting level of the mission, without modifiers such as Steel Path.
 * A mission can set:
 *   startLevel              the starting enemy level (default 1)
 *   additionalCreditReward  extra Credits some missions pay on top (default 0)
 *   noCreditReward          true for missions that pay nothing (Free Roam style sandboxes)
 */

export const BASE_CREDIT_REWARD = 1000;
export const CREDITS_PER_LEVEL = 100;

export function creditReward(mission) {
  if (!mission || mission.noCreditReward) return 0;
  const minLevel = Math.max(1, mission.startLevel ?? 1);
  return BASE_CREDIT_REWARD + CREDITS_PER_LEVEL * (minLevel - 1) + (mission.additionalCreditReward ?? 0);
}
