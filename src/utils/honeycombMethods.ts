// Available Honeycomb Protocol Client Methods
// Based on your client inspection output

export const HONEYCOMB_METHODS = {
  // Asset Management
  transferAssets: 'createTransferAssetsTransactions',
  burnAssets: 'createBurnAssetsTransactions',
  
  // User Management
  createUser: 'createNewUserTransaction',
  createUserBulk: 'createNewUserBulkTransaction', 
  updateUser: 'createUpdateUserTransaction',
  createUserWithProfile: 'createNewUserWithProfileTransaction',
  
  // Project Management
  createProject: 'createCreateProjectTransaction',
  changeProjectDriver: 'createChangeProjectDriverTransaction',
  createDelegate: 'createCreateDelegateAuthorityTransaction',
  modifyDelegation: 'createModifyDelegationTransaction',
  
  // Profile Management
  createProfilesTree: 'createCreateProfilesTreeTransaction', // ✅ CONFIRMED WORKING
  createProfile: 'createNewProfileTransaction',
  updateProfile: 'createUpdateProfileTransaction',
  updatePlatformData: 'createUpdatePlatformDataTransaction',
  
  // Character System
  createAssemblerConfig: 'createCreateAssemblerConfigTransaction',
  addCharacterTraits: 'createAddCharacterTraitsTransactions',
  removeCharacterTraits: 'createRemoveCharacterTraitsTransactions',
  createCharacterModel: 'createCreateCharacterModelTransaction',
  createCharactersTree: 'createCreateCharactersTreeTransaction',
  assembleCharacter: 'createAssembleCharacterTransaction',
  updateCharacterTraits: 'createUpdateCharacterTraitsTransaction',
  populateCharacter: 'createPopulateCharacterTransaction',
  wrapAssetsToCharacter: 'createWrapAssetsToCharacterTransactions',
  unwrapAssetsFromCharacter: 'createUnwrapAssetsFromCharacterTransactions',
  equipResource: 'createEquipResourceOnCharacterTransaction',
  dismountResource: 'createDismountResourceOnCharacterTransaction',
  useCharacter: 'createUseCharacterTransaction',
  
  // Staking System
  createStakingPool: 'createCreateStakingPoolTransaction',
  updateStakingPool: 'createUpdateStakingPoolTransaction',
  initMultipliers: 'createInitMultipliersTransaction',
  addMultiplier: 'createAddMultiplierTransaction',
  stakeCharacters: 'createStakeCharactersTransactions',
  claimStakingRewards: 'createClaimStakingRewardsTransactions',
  unstakeCharacters: 'createUnstakeCharactersTransactions',
  
  // SPL Token Staking
  createSplStakingPool: 'createCreateSplStakingPoolTransaction',
  updateSplStakingPool: 'createUpdateSplStakingPoolTransaction',
  createSplStakingTree: 'createCreateNewSplStakingPoolTreeTransaction',
  addRemoveSplMultipliers: 'createAddRemoveSplMultipliersTransaction',
  splRewardPool: 'createSplRewardPoolTransaction',
  addRemoveRewardsFromPool: 'createAddRemoveRewardsFromRewardPoolTransaction',
  stakeSplTokens: 'createStakeSplTokensTransaction',
  claimSplRewards: 'createClaimSplRewardsTransaction',
  unstakeSplTokens: 'createUnstakeSplTokensTransaction',
  
  // Missions System
  createMissionPool: 'createCreateMissionPoolTransaction',
  updateMissionPool: 'createUpdateMissionPoolTransaction',
  createMission: 'createCreateMissionTransaction',
  updateMission: 'createUpdateMissionTransaction',
  sendCharactersOnMission: 'createSendCharactersOnMissionTransaction',
  recallCharacters: 'createRecallCharactersTransaction',
  
  // Resource Management
  createResource: 'createCreateNewResourceTransaction',
  importFungibleResource: 'createImportFungibleResourceTransaction',
  exportFungibleResource: 'createExportFungibleResourceTransaction',
  createResourceTree: 'createCreateNewResourceTreeTransaction',
  mintResource: 'createMintResourceTransaction',
  burnResource: 'createBurnResourceTransaction',
  transferResource: 'createTransferResourceTransaction',
  
  // Holdings/Wrapping
  createWrapHolding: 'createCreateWrapHoldingTransaction',
  createUnwrapHolding: 'createCreateUnwrapHoldingTransaction',
  
  // Utilities
  initializeFaucet: 'createInitializeFaucetTransaction',
  claimFaucet: 'createClaimFaucetTransaction',
  initializeRecipe: 'createInitializeRecipeTransaction',
  addIngredients: 'createAddIngredientsTransaction',
  removeIngredients: 'createRemoveIngredientsTransaction',
  initCookingProcess: 'createInitCookingProcessTransactions',
  
  // Badge System
  initializeBadgeCriteria: 'createInitializeBadgeCriteriaTransaction',
  claimBadgeCriteria: 'createClaimBadgeCriteriaTransaction',
  updateBadgeCriteria: 'createUpdateBadgeCriteriaTransaction',
} as const;

// Helper function to check if a method exists
export function hasHoneycombMethod(client: any, methodKey: keyof typeof HONEYCOMB_METHODS): boolean {
  const methodName = HONEYCOMB_METHODS[methodKey];
  return typeof client[methodName] === 'function';
}

// Helper function to safely call a method
export async function callHoneycombMethod(
  client: any, 
  methodKey: keyof typeof HONEYCOMB_METHODS, 
  params: any
) {
  const methodName = HONEYCOMB_METHODS[methodKey];
  
  if (!hasHoneycombMethod(client, methodKey)) {
    throw new Error(`Method ${methodName} not available in client`);
  }
  
  return await client[methodName](params);
}