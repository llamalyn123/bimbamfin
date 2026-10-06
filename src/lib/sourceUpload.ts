import { supabase, SourceItem } from './supabase';

export interface UploadSourceOptions {
  course?: string;
  week?: number | string;
  showToast?: (msg: string) => void;
  setSources?: React.Dispatch<React.SetStateAction<SourceItem[]>>;
  refreshFromSupabase?: () => Promise<void>;
  onStart?: () => void;
  onError?: (errorMessage: string) => void;
  onSuccess?: (sourceData: any) => void;
}

/**
 * Shared central upload handler for all source file uploads across the app.
 * Guaranteed single code path with required STEP 1 to 4 logs.
 */
export async function uploadSourceFile(
  file: File,
  options: UploadSourceOptions = {}
): Promise<{ success: boolean; error?: string; data?: any }> {
  // STEP 1: Right after a file is picked
  console.log('STEP 1 file picked', file.name);
  if (options.showToast) {
    options.showToast(`Uploading ${file.name}…`);
  }
  if (options.onStart) {
    options.onStart();
  }

  try {
    // 1. Get the signed-in user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      const authErr = 'Please sign in again';
      console.error('AUTH ERROR', authErr);
      if (options.showToast) options.showToast(authErr);
      if (options.onError) options.onError(authErr);
      return { success: false, error: authErr };
    }

    // STEP 2: Before storage upload
    const path = `${user.id}/${Date.now()}-${file.name}`;
    console.log('STEP 2 uploading to', path);

    // STEP 3: Storage upload & result logging
    const { data: storageData, error: upErr } = await supabase.storage.from('sources').upload(path, file);
    console.log('STEP 3 storage result', storageData, upErr);

    if (upErr) {
      console.error('UPLOAD ERROR', upErr);
      if (options.showToast) options.showToast(upErr.message);
      if (options.onError) options.onError(upErr.message);
      return { success: false, error: upErr.message };
    }

    // STEP 4: Insert row into sources table & result logging
    const activeCourse = options.course || 'FIN 301';
    const activeWeek = options.week !== undefined && options.week !== null ? options.week : 4;

    const { data: insertData, error: insErr } = await supabase.from('sources').insert({
      user_id: user.id,
      course: activeCourse,
      week: activeWeek,
      file_url: path,
      upload_method: 'upload'
    }).select();
    console.log('STEP 4 insert result', insertData, insErr);

    if (insErr) {
      console.error('SOURCES INSERT ERROR', insErr);
      if (options.showToast) options.showToast(insErr.message);
      if (options.onError) options.onError(insErr.message);
      return { success: false, error: insErr.message };
    }

    // Success handling: show "Source added" and refresh the source list
    if (options.showToast) {
      options.showToast('Source added');
    }

    try {
      const { data: refreshedSources, error: fetchErr } = await supabase.from('sources').select('*');
      if (fetchErr) {
        console.error('SOURCES REFRESH ERROR', fetchErr);
      } else if (refreshedSources && options.setSources) {
        options.setSources(refreshedSources as SourceItem[]);
      }
      if (options.refreshFromSupabase) {
        await options.refreshFromSupabase();
      }
    } catch (refreshErr) {
      console.error('REFRESH ERROR', refreshErr);
    }

    if (options.onSuccess) {
      options.onSuccess(insertData);
    }

    return { success: true, data: insertData };

  } catch (err: any) {
    const errorMsg = err?.message || 'An unexpected error occurred during upload.';
    console.error('UPLOAD FLOW ERROR', err);
    if (options.showToast) options.showToast(errorMsg);
    if (options.onError) options.onError(errorMsg);
    return { success: false, error: errorMsg };
  }
}
