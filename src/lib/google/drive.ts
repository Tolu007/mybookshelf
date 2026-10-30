import { google, drive_v3 } from "googleapis";
import { createClient } from "@/lib/supabase/server";
import { DriveAccessError } from "@/lib/book-file-errors";

const APP_FOLDER_NAME = "Shelf Library";

async function getOAuthClient(userId: string) {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    throw new DriveAccessError("drive_configuration");
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_google_tokens")
    .select("refresh_token")
    .eq("user_id", userId)
    .single();

  if (error && error.code !== "PGRST116") throw new DriveAccessError("token_store_unavailable");
  if (!data?.refresh_token) throw new DriveAccessError("drive_reconnect");

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  oauth2Client.setCredentials({ refresh_token: data.refresh_token });
  return oauth2Client;
}

async function getAuthorizedDrive(userId: string) {
  const auth = await getOAuthClient(userId);
  return google.drive({ version: "v3", auth });
}

async function getOrCreateAppFolderId(drive: drive_v3.Drive) {
  const existing = await drive.files.list({
    q: `name='${APP_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: "files(id)",
    spaces: "drive",
  });

  const existingId = existing.data.files?.[0]?.id;
  if (existingId) return existingId;

  const created = await drive.files.create({
    requestBody: {
      name: APP_FOLDER_NAME,
      mimeType: "application/vnd.google-apps.folder",
    },
    fields: "id",
  });

  return created.data.id!;
}

// Hands the browser a one-time, pre-authorized session URL so the file's
// bytes stream straight to Google — never through our server — which avoids
// any serverless request-body size limit for large PDFs/EPUBs.
export async function createResumableUploadSession(
  userId: string,
  file: { name: string; mimeType: string }
) {
  const auth = await getOAuthClient(userId);
  const drive = google.drive({ version: "v3", auth });
  const folderId = await getOrCreateAppFolderId(drive);

  const { token } = await auth.getAccessToken();
  if (!token) throw new Error("Could not obtain a Drive access token.");

  const response = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,size",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": file.mimeType,
      },
      body: JSON.stringify({ name: file.name, parents: [folderId] }),
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to start a Drive upload session (${response.status}).`);
  }

  const uploadUrl = response.headers.get("location");
  if (!uploadUrl) {
    throw new Error("Drive did not return an upload session URL.");
  }

  return uploadUrl;
}

export async function getBookFileStream(userId: string, driveFileId: string) {
  const drive = await getAuthorizedDrive(userId);
  const response = await drive.files.get(
    { fileId: driveFileId, alt: "media" },
    { responseType: "stream" }
  );
  return response.data;
}

export async function deleteBookFile(userId: string, driveFileId: string) {
  const drive = await getAuthorizedDrive(userId);
  await drive.files.delete({ fileId: driveFileId });
}

// Overall Drive usage and limit (the limit is absent on unlimited plans).
// About.get works with the drive.file scope Shelf asks for.
export async function getDriveStorageQuota(userId: string) {
  const drive = await getAuthorizedDrive(userId);
  const { data } = await drive.about.get({ fields: "storageQuota(limit,usage)" });
  return {
    usage: Number(data.storageQuota?.usage ?? 0),
    limit: data.storageQuota?.limit ? Number(data.storageQuota.limit) : null,
  };
}
