import { ModelRun, ModelConsistency } from '../types';

/**
 * Generate synthetic consistency metrics comparing CUSTOMER vs GEO models.
 * This is for demo purposes - in production, this would compare actual dual model runs.
 */
export function generateModelConsistency(
  customerModel: ModelRun | null,
  geoModel: ModelRun | null
): ModelConsistency | null {
  // If we don't have both models, no consistency analysis
  if (!customerModel || !geoModel) {
    return null;
  }

  // Extract channel ROIs from both models
  const customerChannels = customerModel.channelDetails;
  const geoChannels = geoModel.channelDetails;

  // Find common channels
  const customerChannelMap = new Map(
    customerChannels.map(ch => [ch.channel, ch.roi])
  );
  const geoChannelMap = new Map(
    geoChannels.map(ch => [ch.channel, ch.roi])
  );

  const commonChannels = Array.from(customerChannelMap.keys()).filter(ch =>
    geoChannelMap.has(ch)
  );

  // Calculate per-channel agreement
  const channelAgreement = commonChannels.map(channel => {
    const customerROI = customerChannelMap.get(channel) || 0;
    const geoROI = geoChannelMap.get(channel) || 0;

    // Agreement score based on relative difference
    const avgROI = (customerROI + geoROI) / 2;
    const difference = Math.abs(customerROI - geoROI);
    const relativeDifference = avgROI > 0 ? (difference / avgROI) * 100 : 100;

    // Agreement score: 100 = perfect match, 0 = completely different
    const agreementScore = Math.max(0, 100 - relativeDifference);

    return {
      channel,
      agreementScore: Math.round(agreementScore),
      consistent: agreementScore >= 70 // Threshold for "consistent"
    };
  });

  // Identify conflicting channels (agreement < 70%)
  const conflictingChannels = commonChannels
    .map(channel => {
      const customerROI = customerChannelMap.get(channel) || 0;
      const geoROI = geoChannelMap.get(channel) || 0;
      const difference = Math.abs(customerROI - geoROI);
      const agreement = channelAgreement.find(ca => ca.channel === channel);

      return {
        channel,
        customerROI,
        geoROI,
        difference,
        direction: customerROI > geoROI ? 'CUSTOMER_HIGHER' as const : 'GEO_HIGHER' as const,
        agreementScore: agreement?.agreementScore || 0
      };
    })
    .filter(ch => ch.agreementScore < 70)
    .sort((a, b) => a.agreementScore - b.agreementScore); // Most conflicting first

  // Calculate overall agreement score (weighted average)
  const overallAgreementScore = channelAgreement.length > 0
    ? Math.round(
        channelAgreement.reduce((sum, ch) => sum + ch.agreementScore, 0) /
        channelAgreement.length
      )
    : 0;

  // Determine recommended owner model
  let recommendedOwnerModel: 'CUSTOMER' | 'GEO' | 'DUAL';
  let reasoning: string;

  if (overallAgreementScore >= 80) {
    recommendedOwnerModel = 'DUAL';
    reasoning = `High agreement (${overallAgreementScore}%) between models suggests both perspectives are valid. Run both CUSTOMER and GEO models for comprehensive insights.`;
  } else if (conflictingChannels.length === 0) {
    recommendedOwnerModel = 'DUAL';
    reasoning = `All channels show consistent results. Both models provide reliable insights.`;
  } else if (conflictingChannels.length >= commonChannels.length * 0.5) {
    // More than 50% channels conflicting
    const customerPerformance = customerModel.rsq;
    const geoPerformance = geoModel.rsq;

    if (customerPerformance > geoPerformance * 1.1) {
      recommendedOwnerModel = 'CUSTOMER';
      reasoning = `Significant conflicts detected (${conflictingChannels.length} channels). CUSTOMER model shows superior fit (R²: ${(customerPerformance * 100).toFixed(1)}% vs ${(geoPerformance * 100).toFixed(1)}%). Recommend CUSTOMER-level modeling as primary.`;
    } else if (geoPerformance > customerPerformance * 1.1) {
      recommendedOwnerModel = 'GEO';
      reasoning = `Significant conflicts detected (${conflictingChannels.length} channels). GEO model shows superior fit (R²: ${(geoPerformance * 100).toFixed(1)}% vs ${(customerPerformance * 100).toFixed(1)}%). Recommend GEO-level modeling as primary.`;
    } else {
      recommendedOwnerModel = 'DUAL';
      reasoning = `Models show different perspectives with similar performance. Run both for complete understanding, or reassign conflicting channels based on domain knowledge.`;
    }
  } else {
    recommendedOwnerModel = 'DUAL';
    reasoning = `Some conflicts detected but agreement is moderate (${overallAgreementScore}%). Dual modeling recommended with careful interpretation of conflicting channels.`;
  }

  return {
    overallAgreementScore,
    conflictingChannels,
    recommendedOwnerModel,
    reasoning,
    channelAgreement
  };
}

/**
 * Generate a synthetic GEO model based on a CUSTOMER model (for demo purposes).
 * Introduces controlled variation to simulate different model perspectives.
 */
export function generateSyntheticGeoModel(customerModel: ModelRun): ModelRun {
  // Create variation factors (10-30% difference in ROI)
  const variationSeed = Math.random();

  return {
    ...customerModel,
    id: `${customerModel.id}_GEO`,
    algorithm: customerModel.algorithm,
    // Slightly different performance metrics
    rsq: Math.max(0.5, Math.min(0.95, customerModel.rsq + (Math.random() - 0.5) * 0.1)),
    mape: Math.max(5, Math.min(30, customerModel.mape + (Math.random() - 0.5) * 5)),
    // Vary channel details to create conflicts
    channelDetails: customerModel.channelDetails.map((ch, idx) => {
      // Some channels will be consistent, others will conflict
      const shouldConflict = (idx + variationSeed) % 3 === 0; // ~33% conflict rate
      const variationFactor = shouldConflict
        ? 0.5 + Math.random() * 1.0  // 50-150% of original (creates conflict)
        : 0.85 + Math.random() * 0.3; // 85-115% of original (consistent)

      return {
        ...ch,
        roi: ch.roi * variationFactor,
        mROI: ch.mROI * variationFactor,
        contribution: ch.contribution * variationFactor
      };
    }),
    diagnostics: {
      ...customerModel.diagnostics,
      warning_count: Math.max(0, customerModel.diagnostics.warning_count + Math.floor(Math.random() * 2) - 1)
    }
  };
}

/**
 * Duplicate a model leaderboard for GEO perspective (demo purposes)
 */
export function generateDualModelLeaderboards(
  customerLeaderboard: ModelRun[]
): { customer: ModelRun[], geo: ModelRun[] } {
  return {
    customer: customerLeaderboard,
    geo: customerLeaderboard.map(model => generateSyntheticGeoModel(model))
  };
}
