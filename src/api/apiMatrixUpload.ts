import { getMatrixClientService } from '../services/matrixClientRegistry';

interface MatrixUploadControl {
	abort: () => void;
}

/**
 * Compatibility wrapper for older imports.
 * Matrix attachment delivery must stay on the Matrix SDK path.
 */
export const apiMatrixUploadFile = (
	attachment: File,
	matrixRoomId: string,
	uploadProgress: (percentUpload: number) => void,
	handleUploadControl: (control: MatrixUploadControl) => void
) => {
	const abortController = new AbortController();
	handleUploadControl({ abort: () => abortController.abort() });

	return getMatrixClientService()
		?.sendFileMessage(matrixRoomId, attachment, {
			abortController,
			uploadProgress
		})
		.then(() => ({
			file_name: attachment.name,
			file_size: attachment.size
		}));
};
