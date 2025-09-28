import { google } from 'googleapis';

export class DocumentService {
  async initialize(accessToken: string) {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });
    
    return google.drive({ version: 'v3', auth });
  }

  async getRecentFiles(drive: any, maxResults = 50) {
    try {
      const response = await drive.files.list({
        pageSize: maxResults,
        orderBy: 'modifiedTime desc',
        fields: 'files(id,name,parents,mimeType,modifiedTime,createdTime)',
      });

      return response.data.files || [];
    } catch (error) {
      console.error('Error fetching files:', error);
      throw error;
    }
  }

  async moveFile(drive: any, fileId: string, newParentId: string) {
    try {
      const file = await drive.files.get({
        fileId,
        fields: 'parents',
      });

      const previousParents = file.data.parents.join(',');

      const response = await drive.files.update({
        fileId,
        addParents: newParentId,
        removeParents: previousParents,
      });

      return response.data;
    } catch (error) {
      console.error('Error moving file:', error);
      throw error;
    }
  }

  async createFolder(drive: any, name: string, parentId?: string) {
    try {
      const folderMetadata = {
        name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: parentId ? [parentId] : undefined,
      };

      const response = await drive.files.create({
        resource: folderMetadata,
      });

      return response.data;
    } catch (error) {
      console.error('Error creating folder:', error);
      throw error;
    }
  }
}

export const documentService = new DocumentService();