// This file defines TypeScript types and interfaces used throughout the extension.

export interface DropboxUploadResponse {
    name: string;
    path_lower: string;
    path_display: string;
    id: string;
    client_modified: string;
    server_modified: string;
    rev: string;
    size: number;
    is_downloadable: boolean;
    content_hash: string;
}

export interface DropboxSharedLinkResponse {
    url: string;
    name: string;
    link_permissions: {
        resolved_visibility: {
            '.tag': string;
        };
    };
    path_lower: string;
}