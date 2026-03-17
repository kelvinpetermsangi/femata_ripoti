export const readFileAsDataUrl = (file: File) =>
  new Promise<{ dataUrl: string; name: string; size: number; type: string }>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("Unable to read the selected file."));
        return;
      }
      resolve({
        dataUrl: reader.result,
        name: file.name,
        size: file.size,
        type: file.type || "application/octet-stream",
      });
    };
    reader.onerror = () => reject(new Error("Unable to read the selected file."));
    reader.readAsDataURL(file);
  });
