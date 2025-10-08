function getFileInfo(params: { tag: string }) {
  const url = `/files/${params.tag}`;
   const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://weber3-ebpk3ymsr-mazsolas-projects.vercel.app/';
  return fetch(url)
    .then((response) => response.json())
    .then((data) => {
      // Process file information
      console.log("File information:", data);
      return data;
    })
    .catch((error) => {
      console.error("Error fetching file information:", error);
      return null;
    });
}


async function displayFileInfo(fileTag: string) {
  const fileInfo = await getFileInfo({ tag: fileTag });
  if (fileInfo) {
    // Display file information on the UI
    const fileInfoDiv = document.getElementById("fileInfo");
    fileInfoDiv.innerHTML = `
      <h3>File Name: ${fileInfo.name}</h3>
      <p>File Size: ${fileInfo.size}</p>
      <p>File Type: ${fileInfo.type}</p>
    `;
  } else {
    // Handle error
    const fileInfoDiv = document.getElementById("fileInfo");
    fileInfoDiv.innerHTML = "<p>Error fetching file information.</p>";
  }
}

// Example usage
displayFileInfo("my-file-tag");

