import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { CvUploadError, parseUploadedCv, saveCvFile } from "@/lib/cv/parser";
import {
  createCv,
  deactivateUserCvs,
} from "@/lib/repositories/cvs";
import { cvUploadSchema } from "@/lib/schemas/cv";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Please sign in to upload your CV." },
      { status: 401 },
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    const parsed = cvUploadSchema.safeParse({ file });
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const uploadFile = parsed.data.file;
    const buffer = Buffer.from(await uploadFile.arrayBuffer());
    const { rawText, parsed: parsedCv, parsingIncomplete } =
      await parseUploadedCv(uploadFile, buffer);

    const filePath = await saveCvFile(
      session.user.id,
      uploadFile.name,
      buffer,
    );

    await deactivateUserCvs(session.user.id);

    const cv = await createCv({
      userId: new ObjectId(session.user.id),
      filePath,
      fileName: uploadFile.name,
      mimeType: uploadFile.type as
        | "application/pdf"
        | "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        | "text/plain",
      rawText,
      parsed: parsedCv,
      parsingIncomplete,
      isActive: true,
      uploadedAt: new Date(),
    });

    return NextResponse.json({
      id: cv._id.toString(),
      fileName: cv.fileName,
      parsed: cv.parsed,
      parsingIncomplete: cv.parsingIncomplete,
      uploadedAt: cv.uploadedAt,
      message: parsingIncomplete
        ? "Thanks — we've received your CV and we're reviewing it now. We'll have your matches ready shortly."
        : "Your CV has been uploaded and analyzed successfully.",
    });
  } catch (error) {
    if (error instanceof CvUploadError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("CV upload error:", error);
    return NextResponse.json(
      { error: "We couldn't upload your CV right now. Please try again in a moment." },
      { status: 500 },
    );
  }
}
