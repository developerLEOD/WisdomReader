import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  BookMarked,
  Loader2,
  Lock,
  LogIn,
  LogOut,
  Plus,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import { BlcLiteralPartSize, BlcPlan } from '../types/blc';
import { BlcSetupWizard } from './BlcSetupWizard';
import { BlcSessionDashboard } from './BlcSessionDashboard';
import { clearLegacyLocalBlcCache, deleteBlcBookPages } from '../utils/blcLiteralStorage';
import {
  buildFirestoreErrorInfo,
  db,
  OperationType,
  sanitizeForFirestore,
} from '../lib/firebase';
import {
  collection,
  deleteDoc,
  doc,
  getDocsFromServer,
  onSnapshot,
  setDoc,
} from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';

function sortPlansNewestFirst(list: BlcPlan[]): BlcPlan[] {
  return [...list].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

export const BlcPlannerView: React.FC = () => {
  const { user, authReady, isSigningIn, authError, isBlcAuthorized, signInWithGoogle, signOutUser } =
    useAuth();

  const [plans, setPlans] = useState<BlcPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  const [isCreatingNew, setIsCreatingNew] = useState<boolean>(false);
  const [isSyncingCloud, setIsSyncingCloud] = useState<boolean>(false);
  const [hasLoadedCloudOnce, setHasLoadedCloudOnce] = useState<boolean>(false);
  const [cloudError, setCloudError] = useState<string | null>(null);

  useEffect(() => {
    clearLegacyLocalBlcCache();
  }, []);

  const persistPlanToCloud = useCallback(
    async (plan: BlcPlan) => {
      if (!user || !isBlcAuthorized) return;
      const payload: BlcPlan = {
        ...plan,
        userId: plan.userId || user.uid,
      };
      try {
        await setDoc(doc(db, 'blcPlans', plan.id), sanitizeForFirestore(payload), { merge: true });
        setCloudError(null);
      } catch (err: any) {
        const info = buildFirestoreErrorInfo(err, OperationType.WRITE, `blcPlans/${plan.id}`);
        console.error('Firestore Error: ', JSON.stringify(info));
        setCloudError(err?.message || 'Could not save BLC plan to Firebase.');
      }
    },
    [user, isBlcAuthorized]
  );

  const manualRefreshCloud = useCallback(async () => {
    if (!user || !isBlcAuthorized) return;
    setIsSyncingCloud(true);
    setCloudError(null);
    try {
      const snapshot = await getDocsFromServer(collection(db, 'blcPlans'));
      const cloudPlans: BlcPlan[] = [];
      snapshot.forEach(d => {
        const data = d.data() as BlcPlan;
        if (data && data.id && (!data.userId || data.userId === user.uid)) {
          cloudPlans.push(data);
        }
      });
      const sorted = sortPlansNewestFirst(cloudPlans);
      setPlans(sorted);
      setSelectedPlanId(prev => {
        if (prev && sorted.some(p => p.id === prev)) return prev;
        return sorted[0]?.id || null;
      });
    } catch (err: any) {
      const info = buildFirestoreErrorInfo(err, OperationType.LIST, 'blcPlans');
      console.error('Firestore Error: ', JSON.stringify(info));
      setCloudError(err?.message || 'Could not fetch saved BLCs from Firebase.');
    } finally {
      setHasLoadedCloudOnce(true);
      setIsSyncingCloud(false);
    }
  }, [user, isBlcAuthorized]);

  // Real-time Firestore listener bound strictly to authorized Firebase Auth session (database-only)
  useEffect(() => {
    if (!authReady || !user || !isBlcAuthorized) {
      setPlans([]);
      setSelectedPlanId(null);
      setHasLoadedCloudOnce(false);
      setIsSyncingCloud(false);
      return;
    }

    clearLegacyLocalBlcCache();
    setIsSyncingCloud(true);
    setCloudError(null);

    const plansCol = collection(db, 'blcPlans');
    const unsubscribe = onSnapshot(
      plansCol,
      snapshot => {
        const cloudPlans: BlcPlan[] = [];
        snapshot.forEach(d => {
          const data = d.data() as BlcPlan;
          if (data && data.id && (!data.userId || data.userId === user.uid)) {
            cloudPlans.push(data);
          }
        });

        const sorted = sortPlansNewestFirst(cloudPlans);
        setPlans(sorted);
        setSelectedPlanId(prev =>
          prev && sorted.some(p => p.id === prev) ? prev : sorted[0]?.id || null
        );
        setHasLoadedCloudOnce(true);
        setIsSyncingCloud(false);
      },
      error => {
        const info = buildFirestoreErrorInfo(error, OperationType.LIST, 'blcPlans');
        console.error('Firestore Error: ', JSON.stringify(info));
        setCloudError(
          error.message || 'Missing permission or connectivity error loading saved BLCs.'
        );
        setHasLoadedCloudOnce(true);
        setIsSyncingCloud(false);
      }
    );

    return () => unsubscribe();
  }, [authReady, user, isBlcAuthorized]);

  const activePlan = plans.find(p => p.id === selectedPlanId) || plans[0] || null;

  const handlePlanGenerated = (newPlan: BlcPlan) => {
    const planWithOwner: BlcPlan = user ? { ...newPlan, userId: user.uid } : newPlan;
    setPlans(prev => [planWithOwner, ...prev.filter(p => p.id !== planWithOwner.id)]);
    setSelectedPlanId(planWithOwner.id);
    setIsCreatingNew(false);
    void persistPlanToCloud(planWithOwner);
  };

  const handleToggleSessionComplete = (planId: string, sessionNumber: number) => {
    let updatedPlan: BlcPlan | null = null;
    setPlans(prev =>
      prev.map(plan => {
        if (plan.id !== planId) return plan;
        updatedPlan = {
          ...plan,
          updatedAt: Date.now(),
          sessions: plan.sessions.map(s =>
            s.sessionNumber === sessionNumber ? { ...s, completed: !s.completed } : s
          ),
        };
        return updatedPlan;
      })
    );
    if (updatedPlan) {
      void persistPlanToCloud(updatedPlan);
    }
  };

  const handleUpdateSessionNotes = (planId: string, sessionNumber: number, notes: string) => {
    let updatedPlan: BlcPlan | null = null;
    setPlans(prev =>
      prev.map(plan => {
        if (plan.id !== planId) return plan;
        updatedPlan = {
          ...plan,
          updatedAt: Date.now(),
          sessions: plan.sessions.map(s =>
            s.sessionNumber === sessionNumber ? { ...s, facilitatorNotes: notes } : s
          ),
        };
        return updatedPlan;
      })
    );
    if (updatedPlan) {
      void persistPlanToCloud(updatedPlan);
    }
  };

  const handleUpdatePartSize = (planId: string, literalPartSize: BlcLiteralPartSize) => {
    let updatedPlan: BlcPlan | null = null;
    setPlans(prev =>
      prev.map(plan => {
        if (plan.id !== planId) return plan;
        updatedPlan = {
          ...plan,
          updatedAt: Date.now(),
          config: {
            ...plan.config,
            includeLiteralText: true,
            literalPartSize,
          },
        };
        return updatedPlan;
      })
    );
    if (updatedPlan) {
      void persistPlanToCloud(updatedPlan);
    }
  };

  const handleUpdateSessionChapters = (
    planId: string,
    sessionNumber: number,
    chaptersCovered: string[]
  ) => {
    if (!chaptersCovered || chaptersCovered.length === 0) return;
    let updatedPlan: BlcPlan | null = null;
    setPlans(prev =>
      prev.map(plan => {
        if (plan.id !== planId) return plan;
        updatedPlan = {
          ...plan,
          updatedAt: Date.now(),
          sessions: plan.sessions.map(s =>
            s.sessionNumber === sessionNumber ? { ...s, chaptersCovered } : s
          ),
        };
        return updatedPlan;
      })
    );
    if (updatedPlan) {
      void persistPlanToCloud(updatedPlan);
    }
  };

  const handleDeletePlan = async (planId: string) => {
    await deleteBlcBookPages(planId);
    if (user && isBlcAuthorized) {
      try {
        await deleteDoc(doc(db, 'blcPlans', planId));
      } catch (err) {
        const info = buildFirestoreErrorInfo(err, OperationType.DELETE, `blcPlans/${planId}`);
        console.error('Firestore Error: ', JSON.stringify(info));
      }
    }

    const remaining = plans.filter(p => p.id !== planId);
    setPlans(remaining);
    if (selectedPlanId === planId) {
      setSelectedPlanId(remaining.length > 0 ? remaining[0].id : null);
    }
    if (remaining.length === 0) {
      setIsCreatingNew(true);
    }
  };

  // 1. Loading State
  if (!authReady) {
    return (
      <div className="max-w-md mx-auto my-16 p-8 bg-[#FBF7EE] border border-[#E2D4C3] rounded-2xl text-center space-y-4 shadow-sm">
        <Loader2 className="w-8 h-8 text-[#8C5A2B] animate-spin mx-auto" />
        <p className="text-sm font-sans-ui text-[#5E5043]">Verifying authorization status...</p>
      </div>
    );
  }

  // 2. Unauthenticated State: Sign In Required
  if (!user) {
    return (
      <div className="max-w-lg mx-auto my-12 sm:my-16 p-6 sm:p-8 bg-[#FBF7EE] border border-[#E2D4C3] rounded-2xl text-center space-y-6 shadow-md">
        <div className="w-12 h-12 rounded-xl bg-[#2A1E17] text-[#D4A373] flex items-center justify-center mx-auto shadow-sm">
          <Lock className="w-6 h-6 text-[#D4A373]" />
        </div>
        <div className="space-y-2">
          <h3 className="font-serif-display font-bold text-2xl text-[#2A1E17]">
            Book Learning Circle Planner
          </h3>
          <p className="text-xs sm:text-sm font-sans-ui text-[#5E5043] leading-relaxed max-w-sm mx-auto">
            Access to the BLC Session Planner is restricted. Please sign in with an authorized Google account to view and create learning circles.
          </p>
        </div>

        {authError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 text-left">
            {authError}
          </div>
        )}

        <button
          type="button"
          onClick={signInWithGoogle}
          disabled={isSigningIn}
          className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-[#2A1E17] hover:bg-[#3D2C22] text-[#FBF7EE] text-sm font-semibold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-60"
        >
          {isSigningIn ? (
            <Loader2 className="w-4 h-4 animate-spin text-[#D4A373]" />
          ) : (
            <LogIn className="w-4 h-4 text-[#D4A373]" />
          )}
          <span>{isSigningIn ? 'Signing in...' : 'Sign in with Google'}</span>
        </button>
      </div>
    );
  }

  // 3. Authenticated but Unauthorized Account
  if (!isBlcAuthorized) {
    return (
      <div className="max-w-lg mx-auto my-12 sm:my-16 p-6 sm:p-8 bg-[#FBF7EE] border border-amber-300 rounded-2xl text-center space-y-6 shadow-md">
        <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center mx-auto border border-amber-300">
          <ShieldAlert className="w-6 h-6 text-amber-800" />
        </div>
        <div className="space-y-2">
          <h3 className="font-serif-display font-bold text-2xl text-[#2A1E17]">
            Access Restricted
          </h3>
          <p className="text-xs sm:text-sm font-sans-ui text-[#5E5043] leading-relaxed">
            The signed-in account <span className="font-semibold text-[#2A1E17]">({user.email})</span> is not authorized to access the BLC Planner.
          </p>
          <p className="text-xs font-sans-ui text-[#7A6B5D]">
            If you manage reading circles under an authorized account, please switch accounts below.
          </p>
        </div>

        {authError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 text-left">
            {authError}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
          <button
            type="button"
            onClick={signInWithGoogle}
            disabled={isSigningIn}
            className="flex-1 min-h-[42px] py-2 px-3 rounded-xl bg-[#2A1E17] hover:bg-[#3D2C22] text-[#FBF7EE] text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 shadow-sm"
          >
            <LogIn className="w-4 h-4 text-[#D4A373]" />
            <span>Switch Google Account</span>
          </button>
          <button
            type="button"
            onClick={signOutUser}
            className="min-h-[42px] py-2 px-4 rounded-xl bg-[#F4EDE2] hover:bg-[#E8DDCB] text-[#2A1E17] border border-[#D8C8B4] text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-4 h-4 text-[#7A6B5D]" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    );
  }

  // 4. Authorized User: Render BLC Planner
  const renderCloudErrorBanner = () => {
    if (!cloudError) return null;
    return (
      <div className="mb-4 p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-950">
        <div className="flex items-start gap-2 min-w-0">
          <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <span className="font-semibold block">Could not load saved BLCs from Firebase</span>
            <span className="text-[11px] text-amber-900 break-words">{cloudError}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={manualRefreshCloud}
          disabled={isSyncingCloud}
          className="min-h-[36px] px-3 py-1.5 rounded-lg bg-white border border-amber-300 hover:bg-amber-100 text-xs font-semibold text-amber-950 flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isSyncingCloud ? 'animate-spin' : ''}`} />
          <span>Retry Load</span>
        </button>
      </div>
    );
  };

  if ((!hasLoadedCloudOnce || isSyncingCloud) && plans.length === 0 && !isCreatingNew && !cloudError) {
    return (
      <div className="max-w-md mx-auto my-16 p-8 bg-[#FBF7EE] border border-[#E2D4C3] rounded-2xl text-center space-y-4 shadow-sm">
        <Loader2 className="w-8 h-8 text-[#8C5A2B] animate-spin mx-auto" />
        <p className="text-sm font-sans-ui text-[#5E5043]">
          Loading your saved Book Learning Circles from database...
        </p>
      </div>
    );
  }

  if (isCreatingNew || !activePlan) {
    return (
      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-8 pt-4 sm:pt-6">
        {renderCloudErrorBanner()}
        <BlcSetupWizard
          onPlanGenerated={handlePlanGenerated}
          onCancel={plans.length > 0 ? () => setIsCreatingNew(false) : undefined}
          hasExistingPlans={plans.length > 0}
        />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-8 py-4 sm:py-6 space-y-5 sm:space-y-6">
      {renderCloudErrorBanner()}

      {/* Saved Circles Strip (hidden during print) */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#E2D4C3]">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none touch-pan-x">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#7A6B5D] mr-1 flex items-center gap-1.5 shrink-0">
            <BookMarked className="w-3.5 h-3.5 text-[#8C5A2B]" />
            Saved Circles ({plans.length})
            {isSyncingCloud ? (
              <Loader2 className="w-3 h-3 animate-spin text-[#8C5A2B] ml-1" />
            ) : (
              <button
                type="button"
                onClick={manualRefreshCloud}
                title={`Synced to Firebase (click to refresh)`}
                className="text-[#8C5A2B] hover:text-[#2A1E17] ml-1 flex items-center cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            )}
          </span>

          {plans.map(plan => {
            const isSelected = plan.id === activePlan.id;
            const done = plan.sessions.filter(s => s.completed).length;
            return (
              <button
                key={plan.id}
                type="button"
                onClick={() => setSelectedPlanId(plan.id)}
                className={`min-h-[38px] px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 ${
                  isSelected
                    ? 'bg-[#2A1E17] text-[#FBF7EE] border-[#2A1E17]'
                    : 'bg-[#F4EDE2] text-[#2A1E17] border-[#D8C8B4] hover:border-[#8C5A2B]'
                }`}
              >
                <span className="max-w-[160px] sm:max-w-[180px] truncate">{plan.bookTitle}</span>
                <span
                  className={`text-[11px] tabular-nums ${
                    isSelected ? 'text-[#D4A373]' : 'text-[#7A6B5D]'
                  }`}
                >
                  {done}/{plan.sessions.length}
                </span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setIsCreatingNew(true)}
          className="w-full sm:w-auto min-h-[42px] px-3.5 py-2 text-xs font-semibold text-[#FBF7EE] bg-[#2A1E17] hover:bg-[#3D2C22] rounded-lg transition-colors flex items-center justify-center gap-1.5 shrink-0"
        >
          <Plus className="w-3.5 h-3.5 text-[#D4A373]" />
          <span>Plan New BLC</span>
        </button>
      </div>

      <BlcSessionDashboard
        plan={activePlan}
        onToggleSessionComplete={handleToggleSessionComplete}
        onUpdateSessionNotes={handleUpdateSessionNotes}
        onDeletePlan={handleDeletePlan}
        onUpdatePartSize={handleUpdatePartSize}
        onSyncSessionChapters={handleUpdateSessionChapters}
      />
    </div>
  );
};
